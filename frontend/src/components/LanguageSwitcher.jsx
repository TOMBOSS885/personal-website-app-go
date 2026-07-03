import { motion } from 'framer-motion'
import { Globe } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

export default function LanguageSwitcher() {
  const { language, toggleLanguage } = useLanguage()

  return (
    <motion.button
      onClick={toggleLanguage}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-gray-700 shadow-sm shadow-indigo-500/10 backdrop-blur-md transition-colors hover:bg-white hover:text-gray-950 dark:border-gray-700/70 dark:bg-gray-800/90 dark:text-gray-100 dark:hover:bg-gray-700"
      title={language === 'zh' ? 'Switch to English' : '切换到中文'}
    >
      <Globe className="w-4 h-4" />
      <span className="text-sm font-medium">
        {language === 'zh' ? 'EN' : '中'}
      </span>
    </motion.button>
  )
}
