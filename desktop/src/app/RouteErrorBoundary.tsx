import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

type State = { error: Error | null }

export class RouteErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('Uncaught desktop UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="fatal-screen">
        <AlertTriangle size={28} />
        <h1>页面暂时无法显示</h1>
        <p>{this.state.error.message || '发生了未知错误'}</p>
        <button className="button button-primary" onClick={() => window.location.reload()}>
          重新加载应用
        </button>
      </main>
    )
  }
}
