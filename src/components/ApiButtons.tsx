'use client' // Required for Next.js App Router

import { useState } from 'react'

export default function ApiButtons() {
  const [response, setResponse] = useState<string>('') // State for the response from API
  const [prediction, setPrediction] = useState<number | null>(null) // State for the prediction

  // Handle GET request
  const handleGet = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/hello')
      const data: { message: string } = await res.json()
      setResponse(data.message)
    } catch (error) {
      console.error('Error fetching data:', error)
      setResponse('Error fetching data')
    }
  }

  // Handle POST request
  const handlePost = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/send-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello from Frontend!' }),
      })
      const data: { status: string } = await res.json()
      setResponse(data.status)
    } catch (error) {
      console.error('Error sending data:', error)
      setResponse('Error sending data')
    }
  }

  // Handle Predict request (POST)
  const handlePredict = async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/predict', {
        method: 'GET',
      })
      const data = await res.json()
      setPrediction(data.prediction) // Display the prediction
    } catch (error) {
      console.error('Error getting prediction:', error)
      setResponse('Error getting prediction')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-6">
      <h1 className="text-2xl font-bold">Flask API Test</h1>

      <div className="flex space-x-4">
        <button
          onClick={handleGet}
          className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        >
          GET
        </button>

        <button
          onClick={handlePost}
          className="rounded-lg bg-green-500 px-4 py-2 text-white hover:bg-green-600"
        >
          POST
        </button>

        <button
          onClick={handlePredict}
          className="rounded-lg bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600"
        >
          PREDICT
        </button>
      </div>

      {/* Display Response */}
      {response && (
        <p className="mt-4 rounded-lg border border-gray-300 p-2">{response}</p>
      )}

      {/* Display Prediction */}
      {prediction !== null && (
        <p className="mt-4 rounded-lg border border-gray-300 p-2">
          Prediction: {prediction}
        </p>
      )}
    </div>
  )
}
