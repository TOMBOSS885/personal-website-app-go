import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class RootErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Keep diagnostics local to the browser console; never expose stack traces
    // in the rendered page or send them to an external service implicitly.
    console.error('Application rendering error', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div role="alert" className="max-w-md space-y-4">
          <h1 className="text-xl font-semibold">页面暂时无法显示</h1>
          <p>请刷新页面后重试。</p>
          <button type="button" className="rounded border px-4 py-2" onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </div>
      </main>
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary><App /></RootErrorBoundary>
  </React.StrictMode>,
)
