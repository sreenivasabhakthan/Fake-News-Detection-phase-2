import { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle, XCircle, ExternalLink, Newspaper, Zap } from 'lucide-react';
import './App.css';

function App() {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  const analyzeNews = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setFeedbackGiven(false);
    try {
      // Make sure this URL matches your running backend
      const response = await axios.post('http://127.0.0.1:8000/predict', { text: inputText });
      setResult(response.data);
    } catch (error) {
      alert("Error connecting to backend. Is backend.py running?");
      console.error(error);
    }
    setLoading(false);
  };

  const sendFeedback = async (type) => {
    if (!result) return;
    try {
      await axios.post('http://127.0.0.1:8000/feedback', {
        text: result.original_text, prediction: result.label,
        confidence: result.confidence, user_feedback: type
      });
      setFeedbackGiven(true);
    } catch (error) { console.error(error); }
  };

  return (
    <div className="app-container">
      <div className="bg-orb orb1"></div>
      <div className="bg-orb orb2"></div>

      <div className="main-grid">
        {/* LEFT: INPUT */}
        <motion.div className="card input-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <header>
            <h1 className="gradient-title">News Verifier <span className="pro-badge">V2</span></h1>
            <p className="subtitle">Multi-model AI Analysis + Live Verification</p>
          </header>
          <div className="input-wrapper">
            <textarea placeholder="Paste headline or article..." value={inputText} onChange={(e) => setInputText(e.target.value)} disabled={loading} />
          </div>
          <button className="analyze-btn" onClick={analyzeNews} disabled={loading || !inputText.trim()}>
            {loading ? <span><span className="spin">↻</span> Analyzing...</span> : <>Deep Check <Search size={20} /></>}
          </button>
        </motion.div>

        {/* RIGHT: RESULT */}
        <div className="result-column">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div key="res" className="card result-card" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0 }}>
                
                {/* MAIN VERDICT */}
                <div className="result-header">AI VERDICT</div>
                {result.label === 'LABEL_0' ? 
                  <div className="status-badge real"><CheckCircle/> LOOKS REAL</div> : 
                  <div className="status-badge fake"><XCircle/> LIKELY FAKE</div>
                }
                <div className="confidence-section">
                  <div className="confidence-score">{result.confidence.toFixed(0)}<span className="percent">%</span></div>
                  <div className="meter-container">
                     <motion.div className={`meter-fill ${result.label==='LABEL_0'?'real-fill':'fake-fill'}`} 
                       initial={{width: 0}} animate={{width: `${result.confidence}%`}} transition={{duration: 1}}/>
                  </div>
                </div>

                {/* NEW: TONE ANALYSIS (Only shows if backend sends it) */}
                {result.tone && (
                    <div className="tone-section">
                        <div className="result-header"><Zap size={14}/> EMOTIONAL TONE</div>
                        <div className="tone-bar">
                            <div className="tone-label">{result.tone.label}</div>
                            <div className="tone-score">Intensity: {result.tone.score.toFixed(0)}%</div>
                        </div>
                    </div>
                )}

                {/* LIVE SOURCES */}
                <div className="sources-section">
                    <div className="result-header">LIVE CROSS-CHECK</div>
                    {result.sources && result.sources.length > 0 ? (
                        <div className="sources-list">
                            {result.sources.map((source, index) => (
                                <a key={index} href={source.href || source.url} target="_blank" rel="noopener noreferrer" className="source-item">
                                    <Newspaper size={16} />
                                    <span className="source-title">{source.title}</span>
                                    <ExternalLink size={12} style={{opacity: 0.5}}/>
                                </a>
                            ))}
                        </div>
                    ) : (
                        <div className="warning-box">
                            <AlertTriangle size={18} />
                            <span>No matching recent news found.</span>
                        </div>
                    )}
                </div>

                {/* FEEDBACK */}
                <div className="feedback-section">
                  {!feedbackGiven ? (
                    <div className="feedback-buttons">
                      <button className="fb-btn up" onClick={()=>sendFeedback('Correct')}><ThumbsUp size={18}/> Accurate</button>
                      <button className="fb-btn down" onClick={()=>sendFeedback('Wrong')}><ThumbsDown size={18}/> Inaccurate</button>
                    </div>
                  ) : <div className="feedback-thanks">Feedback saved!</div>}
                </div>

              </motion.div>
            ) : (
              <motion.div className="card placeholder-card" initial={{opacity:0}} animate={{opacity:1}}>
                <Search size={50} style={{opacity:0.2, marginBottom: 20}}/>
                <div>Awaiting Input</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
export default App