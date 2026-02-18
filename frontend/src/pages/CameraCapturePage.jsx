import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { classifyApi } from '../api/classify';

const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;

export default function CameraCapturePage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState(null);
  const [classifying, setClassifying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // ---------------------------------------------------------------------------
  // Enumerate video input devices on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function loadDevices() {
      try {
        // Prompt for permission so device labels are available
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach((t) => t.stop());

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
        setDevices(videoInputs);
        if (videoInputs.length > 0) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      } catch {
        setError('Camera access denied or no camera found. Please check browser permissions.');
      }
    }
    loadDevices();
  }, []);

  // ---------------------------------------------------------------------------
  // Stop active stream on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Start / stop camera stream
  // ---------------------------------------------------------------------------
  const startStream = useCallback(async () => {
    setError('');
    setCapturedBlob(null);
    setCapturedUrl(null);
    setResult(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    try {
      const constraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width: { ideal: CAPTURE_WIDTH },
          height: { ideal: CAPTURE_HEIGHT },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      setError('Failed to start camera. Make sure the device is not in use by another application.');
    }
  }, [selectedDeviceId]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Capture snapshot from the live video feed
  // ---------------------------------------------------------------------------
  const captureSnapshot = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || CAPTURE_WIDTH;
    canvas.height = video.videoHeight || CAPTURE_HEIGHT;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setCapturedUrl(URL.createObjectURL(blob));
          setResult(null);
        }
      },
      'image/png',
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Send captured image to ML classify Lambda
  // ---------------------------------------------------------------------------
  const classifyCapture = useCallback(async () => {
    if (!capturedBlob) return;
    setClassifying(true);
    setError('');
    setResult(null);

    try {
      const { data } = await classifyApi.classifyImage(capturedBlob);
      setResult(data);
    } catch (err) {
      const isNetworkFailure = !err.response;
      if (isNetworkFailure) {
        // Backend/Lambda not deployed yet — show a placeholder result
        setResult({
          label: 'Unknown Item',
          confidence: 0,
          category: 'Uncategorized',
          _mock: true,
        });
        setError('Classification service unavailable. Showing placeholder result.');
      } else {
        setError(err.response?.data?.message || err.message || 'Classification failed');
      }
    } finally {
      setClassifying(false);
    }
  }, [capturedBlob]);

  // ---------------------------------------------------------------------------
  // Navigate to Add Item with pre-filled data from classification
  // ---------------------------------------------------------------------------
  const addToInventory = useCallback(() => {
    navigate('/add-item', {
      state: {
        name: result?.label || '',
        category: result?.category || '',
        imageBlob: capturedBlob,
        imageUrl: capturedUrl,
      },
    });
  }, [navigate, result, capturedBlob, capturedUrl]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Camera Capture</h1>
        <p className="text-slate-600 mt-1">
          Connect a camera, capture a snapshot, and classify inventory items
        </p>
      </div>

      {/* Device selector */}
      <div className="max-w-2xl space-y-6">
        <div>
          <label htmlFor="device-select" className="block text-sm font-medium text-slate-700 mb-2">
            Select Camera Device
          </label>
          <div className="flex gap-3">
            <select
              id="device-select"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={streaming}
              className="flex-1 px-4 py-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
            >
              {devices.length === 0 && <option value="">No cameras detected</option>}
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera (${d.deviceId.slice(0, 8)}...)`}
                </option>
              ))}
            </select>

            {!streaming ? (
              <button
                onClick={startStream}
                disabled={devices.length === 0}
                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect
              </button>
            ) : (
              <button
                onClick={stopStream}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Live preview */}
        <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-contain ${streaming ? '' : 'hidden'}`}
          />
          {!streaming && (
            <div className="text-slate-400 text-center p-8">
              <span className="text-5xl block mb-3">📷</span>
              <p>Select a camera and click Connect to start the live preview</p>
            </div>
          )}
          {streaming && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Live
            </div>
          )}
        </div>

        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Capture button */}
        {streaming && (
          <button
            onClick={captureSnapshot}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors text-lg"
          >
            Capture Snapshot
          </button>
        )}

        {/* Captured image + classification */}
        {capturedUrl && (
          <div className="border border-slate-200 rounded-xl p-6 space-y-4 bg-white">
            <h2 className="text-lg font-semibold text-slate-800">Captured Frame</h2>
            <img
              src={capturedUrl}
              alt="Captured frame"
              className="rounded-lg max-h-64 mx-auto border border-slate-200"
            />

            {!result && (
              <button
                onClick={classifyCapture}
                disabled={classifying}
                className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {classifying ? 'Classifying...' : 'Classify Item'}
              </button>
            )}

            {result && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <h3 className="text-sm font-medium text-slate-500 mb-2">Classification Result</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-slate-400">Item</span>
                      <p className="text-lg font-semibold text-slate-800">{result.label}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Category</span>
                      <p className="text-lg font-semibold text-slate-800">{result.category}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Confidence</span>
                      <p className="text-lg font-semibold text-slate-800">
                        {(result.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  {result._mock && (
                    <p className="mt-2 text-xs text-amber-600">
                      Placeholder result — classification backend is not yet deployed.
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={addToInventory}
                    className="flex-1 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Add to Inventory
                  </button>
                  <button
                    onClick={() => {
                      setCapturedBlob(null);
                      setCapturedUrl(null);
                      setResult(null);
                      setError('');
                    }}
                    className="flex-1 py-3 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
                  >
                    Retake
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
