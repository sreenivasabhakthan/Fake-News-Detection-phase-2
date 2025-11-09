from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline
from duckduckgo_search import DDGS
import re
import uvicorn
import os
import pandas as pd
import datetime
import logging

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Configuration ---
FAKE_NEWS_MODEL = "vikram71198/distilroberta-base-finetuned-fake-news-detection"
SENTIMENT_MODEL = "distilbert-base-uncased-finetuned-sst-2-english" # NEW MODEL
FEEDBACK_FILE = "feedback.csv"

app = FastAPI()

# --- CORS ---
origins = ["http://localhost:5173", "http://127.0.0.1:5173", "*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. Load Models ---
logger.info("⏳ Loading AI Models...")
try:
    classifier = pipeline("text-classification", model=FAKE_NEWS_MODEL)
    sentiment_analyzer = pipeline("sentiment-analysis", model=SENTIMENT_MODEL) # NEW PIPELINE
    logger.info("✅ All models loaded successfully!")
except Exception as e:
    logger.error(f"❌ Model failed to load: {e}")
    classifier = None
    sentiment_analyzer = None

# --- 2. Data Models ---
class NewsRequest(BaseModel):
    text: str

class FeedbackRequest(BaseModel):
    text: str
    prediction: str
    confidence: float
    user_feedback: str

# --- 3. Helper Functions ---
def clean_text(text: str) -> str:
    text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
    return re.sub(r'\s+', ' ', text).strip()

def perform_live_search(query: str):
    """Searches DuckDuckGo News for corroborating articles."""
    try:
        search_query = query[:200] if len(query) > 200 else query
        with DDGS() as ddgs:
            results = list(ddgs.news(search_query, max_results=3))
        return results
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return []

# --- 4. API Endpoints ---
@app.post("/predict")
def predict_news(request: NewsRequest):
    if not classifier or not sentiment_analyzer: 
        raise HTTPException(status_code=503, detail="Models not loaded")
    
    cleaned = clean_text(request.text)
    if not cleaned: raise HTTPException(status_code=400, detail="Empty input")

    # 1. Fake News Check
    fake_results = classifier(cleaned, top_k=1)
    fake_result = fake_results[0]
    
    # 2. Sentiment Check (NEW)
    sent_results = sentiment_analyzer(cleaned[:512]) # Limit length for speed
    sent_result = sent_results[0]

    # 3. Live Fact Check
    news_sources = perform_live_search(cleaned)

    return {
        "original_text": request.text,
        "label": fake_result['label'],
        "confidence": fake_result['score'] * 100,
        "tone": { # NEW DATA FIELD
            "label": sent_result['label'], 
            "score": sent_result['score'] * 100
        },
        "sources": news_sources
    }

@app.post("/feedback")
def save_feedback(feedback: FeedbackRequest):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_record = pd.DataFrame([{
        'timestamp': timestamp, 'text': feedback.text, 
        'prediction': feedback.prediction, 'confidence': feedback.confidence, 
        'user_feedback': feedback.user_feedback
    }])
    
    if os.path.exists(FEEDBACK_FILE):
        try: pd.concat([pd.read_csv(FEEDBACK_FILE), new_record], ignore_index=True).to_csv(FEEDBACK_FILE, index=False)
        except: new_record.to_csv(FEEDBACK_FILE, index=False)
    else:
        new_record.to_csv(FEEDBACK_FILE, index=False)
    return {"status": "success"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)