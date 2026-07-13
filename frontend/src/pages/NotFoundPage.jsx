import { ArrowLeft, Home } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <section className="flex min-h-[70vh] items-center justify-center px-4 py-24">
      <div className="max-w-xl text-center">
        <p className="mb-4 text-sm font-semibold text-indigo-600">404</p>
        <h1 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white">页面不存在</h1>
        <p className="mb-8 text-gray-600 dark:text-gray-300">你访问的地址可能已被移动或删除。</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            <Home className="h-4 w-4" />
            首页
          </Link>
        </div>
      </div>
    </section>
  )
}
