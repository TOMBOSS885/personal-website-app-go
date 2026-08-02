import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { applyPageMetadata } from '../utils/pageMetadata'

export default function RouteMetadata({ profile }) {
  const { pathname } = useLocation()
  const { language } = useLanguage()

  useEffect(() => {
    if (/^\/blog\/\d+$/.test(pathname) && document.documentElement.dataset.metadataOwner === pathname) return

    const siteName = profile?.nickname || 'tombossking'
    const isEnglish = language === 'en'
    const pages = {
      '/': {
        title: siteName,
        description: profile?.bio || (isEnglish ? 'Personal projects, technical articles and notes.' : '个人作品、技术文章与学习记录。'),
      },
      '/blog': {
        title: isEnglish ? `Blog - ${siteName}` : `博客文章 - ${siteName}`,
        description: isEnglish ? 'Technical articles, study notes and campus life.' : '技术文章、学习笔记与大学生活记录。',
      },
      '/projects': {
        title: isEnglish ? `Projects - ${siteName}` : `项目作品 - ${siteName}`,
        description: isEnglish ? 'Projects and practical work.' : '项目作品、实践记录与技术探索。',
      },
      '/friends': {
        title: isEnglish ? `Friends and Messages - ${siteName}` : `友链与留言 - ${siteName}`,
        description: isEnglish ? 'Friends, links and public messages.' : '朋友站点、友情链接与公开留言。',
      },
      '/guestbook': {
        title: isEnglish ? `Guestbook - ${siteName}` : `留言板 - ${siteName}`,
        description: isEnglish ? 'Leave a public message.' : '在这里留下公开留言。',
      },
      '/monitor': {
        title: isEnglish ? `Site Monitor - ${siteName}` : `站点监控 - ${siteName}`,
        description: isEnglish ? 'Public site usage overview.' : '站点访问与浏览器估算流量概览。',
      },
      '/search': {
        title: isEnglish ? `Search - ${siteName}` : `搜索 - ${siteName}`,
        description: isEnglish ? 'Search this site.' : '搜索站内文章、项目和内容。',
        robots: 'noindex, follow',
      },
    }
    const metadata = pages[pathname] || (/^\/blog\/\d+$/.test(pathname)
      ? { title: isEnglish ? `Article - ${siteName}` : `文章 - ${siteName}`, description: isEnglish ? 'Article detail.' : '文章详情。' }
      : { title: isEnglish ? `Not Found - ${siteName}` : `页面不存在 - ${siteName}`, description: isEnglish ? 'Page not found.' : '当前页面不存在。', robots: 'noindex, follow' })
    applyPageMetadata({ ...metadata, siteName }, pathname)
  }, [language, pathname, profile])

  return null
}
