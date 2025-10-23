'use client'; // This is important for Next.js App Router!

import React, { useState, useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';

// Game configurations (in production: stored in game folders as config.json)
const GAME_CONFIGS = {
  'letter-trace': {
    id: 'letter-trace',
    name: 'Letter Tracing',
    description: 'Trace letters from A to Z',
    items: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    modelPath: null, // Will implement letter model later
    color: 'bg-blue-500'
  },
  'number-trace': {
    id: 'number-trace',
    name: 'Number Tracing',
    description: 'Trace numbers from 0 to 9',
    items: '0123456789'.split(''),
    modelPath: 'https://storage.googleapis.com/tfjs-models/tfjs/mnist_model/model.json',
    color: 'bg-green-500'
  }
};

// Home Page Component - Shows game cards
function HomePage({ onSelectGame }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold text-white text-center mb-4">
          🎮 Learning Games
        </h1>
        <p className="text-white text-center mb-12 text-xl">
          Choose a game to start learning!
        </p>
        
        <div className="grid md:grid-cols-2 gap-8">
          {Object.values(GAME_CONFIGS).map(game => (
            <GameCard key={game.id} game={game} onSelect={onSelectGame} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Game Card Component
function GameCard({ game, onSelect }) {
  return (
    <div 
      onClick={() => onSelect(game.id)}
      className="bg-white rounded-2xl shadow-2xl p-8 cursor-pointer transform transition-all hover:scale-105 hover:shadow-3xl"
    >
      <div className={`${game.color} w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-4`}>
        {game.id === 'letter-trace' ? '✏️' : '🔢'}
      </div>
      <h2 className="text-3xl font-bold mb-2 text-gray-800">{game.name}</h2>
      <p className="text-gray-600 text-lg mb-4">{game.description}</p>
      <button className={`${game.color} text-white px-6 py-3 rounded-lg font-semibold text-lg hover:opacity-90`}>
        Play Now →
      </button>
    </div>
  );
}

// Main Game Component
function GamePage({ gameId, onBack }) {
  const config = GAME_CONFIGS[gameId];
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  
  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  // Load AI model
  useEffect(() => {
    async function loadModel() {
      if (config.modelPath) {
        try {
          const loadedModel = await tf.loadLayersModel(config.modelPath);
          setModel(loadedModel);
          setLoading(false);
        } catch (error) {
          console.error('Error loading model:', error);
          setLoading(false);
        }
      } else {
        // For letter tracing, we'll simulate AI for POC
        setLoading(false);
      }
    }
    loadModel();
  }, [config.modelPath]);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 400;
    canvas.height = 400;
    
    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.strokeStyle = 'black';
    context.lineWidth = 20;
    contextRef.current = context;

    // Fill with white background
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e) => {
    const { offsetX, offsetY } = e.nativeEvent;
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
    setFeedback('');
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = e.nativeEvent;
    contextRef.current.lineTo(offsetX, offsetY);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    setFeedback('');
  };

  // Check the drawing
  const checkDrawing = async () => {
    const canvas = canvasRef.current;
    const currentItem = config.items[currentIndex];

    if (model) {
      // Use AI for number recognition
      const imageData = contextRef.current.getImageData(0, 0, canvas.width, canvas.height);
      const prediction = await recognizeDigit(imageData, model);
      
      const predictedDigit = prediction.digit;
      const confidence = prediction.confidence;
      
      if (predictedDigit === currentItem) {
        const points = Math.round(confidence * 100);
        setScore(score + points);
        setFeedback(`✅ Perfect! That's a ${currentItem}! (+${points} points)`);
      } else {
        setFeedback(`❌ That looks like a ${predictedDigit}. Try drawing ${currentItem} again!`);
      }
    } else {
      // Simulate AI for letters (for POC)
      // In production, you'd use a real letter recognition model
      const accuracy = Math.random();
      if (accuracy > 0.3) {
        const points = Math.round(accuracy * 100);
        setScore(score + points);
        setFeedback(`✅ Great job! That's a ${currentItem}! (+${points} points)`);
      } else {
        setFeedback(`❌ Not quite! Try drawing ${currentItem} again!`);
      }
    }
  };

  // AI Recognition function for digits
  async function recognizeDigit(imageData, model) {
    // Preprocess the image
    let tensor = tf.browser.fromPixels(imageData, 1);
    
    // Resize to 28x28 (MNIST input size)
    tensor = tf.image.resizeBilinear(tensor, [28, 28]);
    
    // Normalize pixel values
    tensor = tensor.div(255.0);
    
    // Reshape for model input [1, 28, 28, 1]
    tensor = tensor.expandDims(0);
    
    // Make prediction
    const prediction = await model.predict(tensor);
    const probabilities = await prediction.data();
    
    // Get the digit with highest probability
    const digit = probabilities.indexOf(Math.max(...probabilities));
    const confidence = probabilities[digit];
    
    // Clean up tensors
    tensor.dispose();
    prediction.dispose();
    
    return { digit: digit.toString(), confidence };
  }

  const nextItem = () => {
    if (currentIndex < config.items.length - 1) {
      setCurrentIndex(currentIndex + 1);
      clearCanvas();
      setFeedback('');
    }
  };

  const previousItem = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      clearCanvas();
      setFeedback('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center">
        <div className="text-white text-3xl">Loading AI Model... 🤖</div>
      </div>
    );
  }

  const currentItem = config.items[currentIndex];
  const progress = ((currentIndex + 1) / config.items.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 to-blue-400 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button 
            onClick={onBack}
            className="bg-white text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100"
          >
            ← Back
          </button>
          <div className="text-white text-2xl font-bold">
            Score: {score}
          </div>
        </div>

        {/* Game Title */}
        <h1 className="text-4xl font-bold text-white text-center mb-4">
          {config.name}
        </h1>

        {/* Progress */}
        <div className="bg-white rounded-full h-4 mb-8">
          <div 
            className={`${config.color} h-4 rounded-full transition-all`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Game Area */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Current Item Display */}
          <div className="text-center mb-6">
            <div className="text-gray-600 text-xl mb-2">
              {currentIndex + 1} / {config.items.length}
            </div>
            <div className="text-8xl font-bold text-gray-800 mb-2">
              {currentItem}
            </div>
            <div className="text-2xl text-gray-600">
              Draw this {gameId === 'letter-trace' ? 'letter' : 'number'}!
            </div>
          </div>

          {/* Canvas */}
          <div className="flex justify-center mb-6">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className="border-4 border-gray-300 rounded-lg cursor-crosshair shadow-lg"
            />
          </div>

          {/* Feedback */}
          {feedback && (
            <div className={`text-center text-2xl font-bold mb-6 p-4 rounded-lg ${
              feedback.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {feedback}
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center gap-4">
            <button
              onClick={clearCanvas}
              className="bg-gray-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-600"
            >
              🗑️ Clear
            </button>
            <button
              onClick={checkDrawing}
              className={`${config.color} text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90`}
            >
              ✓ Check
            </button>
            <button
              onClick={previousItem}
              disabled={currentIndex === 0}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300"
            >
              ← Previous
            </button>
            <button
              onClick={nextItem}
              disabled={currentIndex === config.items.length - 1}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Completion */}
        {currentIndex === config.items.length - 1 && (
          <div className="mt-8 bg-yellow-400 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <div className="text-2xl font-bold text-gray-800">
              Great job! Final Score: {score}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main App Component
export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [selectedGame, setSelectedGame] = useState(null);

  const handleSelectGame = (gameId) => {
    setSelectedGame(gameId);
    setCurrentView('game');
  };

  const handleBack = () => {
    setCurrentView('home');
    setSelectedGame(null);
  };

  return (
    <div>
      {currentView === 'home' && <HomePage onSelectGame={handleSelectGame} />}
      {currentView === 'game' && <GamePage gameId={selectedGame} onBack={handleBack} />}
    </div>
  );
}