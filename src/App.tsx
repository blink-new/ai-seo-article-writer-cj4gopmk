import { useState, useEffect, useCallback } from 'react'
import { 
  PenTool, 
  Zap, 
  BarChart, 
  Download, 
  Copy, 
  RefreshCw, 
  History, 
  Target, 
  Sparkles,
  TrendingUp,
  FileText,
  Clock,
  Award,
  ChevronRight,
  Star,
  Crown
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { Textarea } from './components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select'
import { Slider } from './components/ui/slider'
import { Badge } from './components/ui/badge'
import { Progress } from './components/ui/progress'
import { Separator } from './components/ui/separator'
import { ScrollArea } from './components/ui/scroll-area'
import { blink } from './blink/client'
import toast, { Toaster } from 'react-hot-toast'

interface Article {
  id: string
  title: string
  content: string
  keywords: string[]
  createdAt: string
  seoScore: number
  readabilityScore: number
  metaDescription?: string
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  
  // Form states
  const [topic, setTopic] = useState('')
  const [keywords, setKeywords] = useState('')
  const [tone, setTone] = useState('professional')
  const [wordCount, setWordCount] = useState([1000])
  const [metaDescription, setMetaDescription] = useState('')
  
  // Generated content
  const [generatedTitle, setGeneratedTitle] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  
  // SEO Analysis
  const [seoScore, setSeoScore] = useState(0)
  const [readabilityScore, setReadabilityScore] = useState(0)
  const [keywordDensity, setKeywordDensity] = useState<{[key: string]: number}>({})

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  const loadArticles = useCallback(async () => {
    if (!user) return
    try {
      const userArticles = await blink.db.articles.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 10
      })
      setArticles(userArticles)
    } catch (error) {
      console.error('Failed to load articles:', error)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadArticles()
    }
  }, [user, loadArticles])

  const generateArticle = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic')
      return
    }

    setGenerating(true)
    setProgress(0)
    
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90))
    }, 500)

    try {
      const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k)
      
      const prompt = `Write a comprehensive, SEO-optimized article about "${topic}".

Requirements:
- Target word count: ${wordCount[0]} words
- Tone: ${tone}
- Primary keywords: ${keywordList.join(', ')}
- Include proper headings (H1, H2, H3)
- Natural keyword integration
- Engaging introduction and conclusion
- Include relevant subheadings
- Make it valuable and informative for readers

Please structure the article with clear sections and make it ready for publication.`

      const { text } = await blink.ai.generateText({
        prompt,
        model: 'gpt-4o',
        maxTokens: Math.max(wordCount[0] * 2, 2000)
      })

      // Generate title if not provided in content
      let title = generatedTitle
      if (!title) {
        const titleMatch = text.match(/^#\s+(.+)$/m)
        title = titleMatch ? titleMatch[1] : `${topic} - Complete Guide`
      }

      // Generate meta description
      if (!metaDescription) {
        const { text: description } = await blink.ai.generateText({
          prompt: `Write a compelling 150-160 character meta description for this article about "${topic}". Include the main keywords: ${keywordList.join(', ')}`,
          model: 'gpt-4o-mini',
          maxTokens: 100
        })
        setMetaDescription(description.replace(/"/g, ''))
      }

      setGeneratedTitle(title)
      setGeneratedContent(text)
      
      // Calculate SEO metrics
      calculateSEOMetrics(text, keywordList)
      
      clearInterval(progressInterval)
      setProgress(100)
      
      toast.success('Article generated successfully!', {
        icon: '✨',
        style: {
          borderRadius: '12px',
          background: '#6366f1',
          color: '#fff',
        },
      })
    } catch (error) {
      clearInterval(progressInterval)
      console.error('Generation failed:', error)
      toast.error('Failed to generate article. Please try again.')
    } finally {
      setGenerating(false)
      setTimeout(() => setProgress(0), 2000)
    }
  }

  const calculateSEOMetrics = (content: string, targetKeywords: string[]) => {
    const words = content.toLowerCase().split(/\s+/)
    const totalWords = words.length
    
    // Calculate keyword density
    const density: {[key: string]: number} = {}
    targetKeywords.forEach(keyword => {
      const keywordWords = keyword.toLowerCase().split(/\s+/)
      let count = 0
      
      if (keywordWords.length === 1) {
        count = words.filter(word => word.includes(keywordWords[0])).length
      } else {
        // Multi-word keyword matching
        const keywordPhrase = keyword.toLowerCase()
        const matches = content.toLowerCase().match(new RegExp(keywordPhrase, 'g'))
        count = matches ? matches.length : 0
      }
      
      density[keyword] = (count / totalWords) * 100
    })
    
    setKeywordDensity(density)
    
    // Calculate SEO score (simplified)
    let score = 0
    if (content.length > 300) score += 20
    if (content.includes('</h') || content.includes('#')) score += 20
    if (targetKeywords.some(k => content.toLowerCase().includes(k.toLowerCase()))) score += 30
    if (content.length > 1000) score += 15
    if (Object.values(density).some(d => d >= 0.5 && d <= 3)) score += 15
    
    setSeoScore(Math.min(score, 100))
    
    // Calculate readability score (simplified Flesch Reading Ease approximation)
    const sentences = content.split(/[.!?]+/).length
    const avgWordsPerSentence = totalWords / sentences
    const readability = Math.max(0, Math.min(100, 100 - (avgWordsPerSentence * 2)))
    setReadabilityScore(Math.round(readability))
  }

  const saveArticle = async () => {
    if (!generatedContent || !user) return

    try {
      const article = await blink.db.articles.create({
        userId: user.id,
        title: generatedTitle,
        content: generatedContent,
        keywords: keywords.split(',').map(k => k.trim()).filter(k => k),
        metaDescription,
        seoScore,
        readabilityScore,
        createdAt: new Date().toISOString()
      })
      
      setArticles(prev => [article, ...prev])
      toast.success('Article saved!', {
        icon: '💾',
        style: {
          borderRadius: '12px',
          background: '#10b981',
          color: '#fff',
        },
      })
    } catch (error) {
      console.error('Failed to save article:', error)
      toast.error('Failed to save article')
    }
  }

  const copyToClipboard = async () => {
    if (!generatedContent) return
    
    try {
      await navigator.clipboard.writeText(generatedContent)
      toast.success('Article copied to clipboard!', {
        icon: '📋',
        style: {
          borderRadius: '12px',
          background: '#8b5cf6',
          color: '#fff',
        },
      })
    } catch (error) {
      toast.error('Failed to copy article')
    }
  }

  const downloadAsMarkdown = () => {
    if (!generatedContent) return
    
    const element = document.createElement('a')
    const file = new Blob([generatedContent], { type: 'text/markdown' })
    element.href = URL.createObjectURL(file)
    element.download = `${generatedTitle || 'article'}.md`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    
    toast.success('Article downloaded!', {
      icon: '⬇️',
      style: {
        borderRadius: '12px',
        background: '#f59e0b',
        color: '#fff',
      },
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center animate-fade-in">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-6"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-accent rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <h3 className="text-xl font-display font-semibold text-slate-900 mb-2">Loading AI SEO Writer</h3>
          <p className="text-slate-600">Preparing your premium content generation experience...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="w-full max-w-md animate-slide-up">
          <Card className="shadow-premium border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-display font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Welcome to AI SEO Writer
              </CardTitle>
              <CardDescription className="text-lg text-slate-600 mt-2">
                Generate premium, SEO-optimized content that ranks on Google
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">AI-Powered</p>
                </div>
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mx-auto">
                    <TrendingUp className="w-6 h-6 text-accent" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">SEO Optimized</p>
                </div>
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto">
                    <Award className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Premium Quality</p>
                </div>
              </div>
              <Button 
                onClick={() => blink.auth.login()} 
                className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Start Creating Premium Content
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
              <p className="text-xs text-slate-500 text-center">
                Join thousands of content creators and marketers
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Toaster position="top-right" />
      
      {/* Premium Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
                <PenTool className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  AI SEO Writer
                </h1>
                <p className="text-sm text-slate-600 font-medium">Premium Content Generation Platform</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-semibold">
                <Star className="w-3 h-3 mr-1" />
                {articles.length} articles
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => blink.auth.logout()}
                className="border-slate-200 hover:bg-slate-50"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Main Content - Article Generator */}
          <div className="xl:col-span-3 space-y-8">
            {/* Hero Section */}
            <div className="text-center space-y-4 animate-fade-in">
              <h2 className="text-4xl font-display font-bold bg-gradient-to-r from-slate-900 via-primary to-accent bg-clip-text text-transparent">
                Generate Premium SEO Content
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                Create high-ranking, engaging articles that drive organic traffic and convert readers into customers
              </p>
            </div>

            {/* Article Input Form */}
            <Card className="shadow-premium border-0 bg-white/80 backdrop-blur-sm animate-slide-up">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center space-x-3 text-2xl font-display">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <span>Content Generator</span>
                </CardTitle>
                <CardDescription className="text-lg text-slate-600">
                  Configure your article parameters for optimal SEO performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="topic" className="text-base font-semibold text-slate-700">
                      Article Topic *
                    </Label>
                    <Input
                      id="topic"
                      placeholder="e.g., Benefits of React for Web Development"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="h-12 border-slate-200 focus:border-primary focus:ring-primary/20 rounded-xl"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="keywords" className="text-base font-semibold text-slate-700">
                      Target Keywords
                    </Label>
                    <Input
                      id="keywords"
                      placeholder="react, web development, javascript"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      className="h-12 border-slate-200 focus:border-primary focus:ring-primary/20 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="tone" className="text-base font-semibold text-slate-700">
                      Tone & Style
                    </Label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger className="h-12 border-slate-200 focus:border-primary focus:ring-primary/20 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual & Friendly</SelectItem>
                        <SelectItem value="academic">Academic</SelectItem>
                        <SelectItem value="conversational">Conversational</SelectItem>
                        <SelectItem value="authoritative">Authoritative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-base font-semibold text-slate-700">
                      Word Count: {wordCount[0]} words
                    </Label>
                    <div className="pt-2">
                      <Slider
                        value={wordCount}
                        onValueChange={setWordCount}
                        max={3000}
                        min={500}
                        step={100}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="meta" className="text-base font-semibold text-slate-700">
                    Meta Description (Optional)
                  </Label>
                  <Textarea
                    id="meta"
                    placeholder="Brief description of your article (150-160 characters)"
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    rows={3}
                    className="border-slate-200 focus:border-primary focus:ring-primary/20 rounded-xl"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    onClick={generateArticle} 
                    disabled={generating || !topic.trim()}
                    className="flex-1 h-14 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg"
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="w-5 h-5 mr-3 animate-spin" />
                        Generating Premium Content...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-3" />
                        Generate Article
                      </>
                    )}
                  </Button>
                  {generatedContent && (
                    <Button 
                      variant="outline" 
                      onClick={saveArticle}
                      className="h-14 px-8 border-slate-200 hover:bg-slate-50 rounded-xl font-semibold"
                    >
                      <History className="w-5 h-5 mr-2" />
                      Save Article
                    </Button>
                  )}
                </div>

                {generating && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-slate-700">Generating premium content...</span>
                      <span className="text-primary">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-3 bg-slate-100" />
                    <div className="text-center">
                      <p className="text-sm text-slate-600">
                        Our AI is crafting SEO-optimized content tailored to your specifications
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Generated Article Preview */}
            {generatedContent && (
              <Card className="shadow-premium border-0 bg-white/80 backdrop-blur-sm animate-slide-up">
                <CardHeader className="pb-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl font-display">Generated Article</CardTitle>
                    <div className="flex space-x-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={copyToClipboard}
                        className="border-slate-200 hover:bg-slate-50 rounded-lg"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={downloadAsMarkdown}
                        className="border-slate-200 hover:bg-slate-50 rounded-lg"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {generatedTitle && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700">Title</Label>
                        <h2 className="text-2xl font-display font-bold text-slate-900">{generatedTitle}</h2>
                      </div>
                    )}
                    {metaDescription && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700">Meta Description</Label>
                        <p className="text-slate-600 bg-slate-50 p-3 rounded-lg">{metaDescription}</p>
                      </div>
                    )}
                    <Separator className="bg-slate-200" />
                    <ScrollArea className="h-96 w-full border border-slate-200 rounded-xl p-6 bg-white">
                      <div className="prose prose-slate max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
                          {generatedContent}
                        </pre>
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Premium Sidebar */}
          <div className="space-y-6">
            {/* SEO Analysis */}
            {generatedContent && (
              <Card className="shadow-premium border-0 bg-white/80 backdrop-blur-sm animate-slide-up">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center space-x-2 text-lg font-display">
                    <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                      <BarChart className="w-4 h-4 text-white" />
                    </div>
                    <span>SEO Analysis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-700">SEO Score</span>
                      <Badge variant={seoScore >= 80 ? "default" : seoScore >= 60 ? "secondary" : "destructive"}>
                        {seoScore}/100
                      </Badge>
                    </div>
                    <Progress value={seoScore} className="h-2" />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-700">Readability</span>
                      <Badge variant={readabilityScore >= 70 ? "default" : readabilityScore >= 50 ? "secondary" : "destructive"}>
                        {readabilityScore}/100
                      </Badge>
                    </div>
                    <Progress value={readabilityScore} className="h-2" />
                  </div>

                  {Object.keys(keywordDensity).length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-slate-700">Keyword Density</Label>
                      <div className="space-y-2">
                        {Object.entries(keywordDensity).map(([keyword, density]) => (
                          <div key={keyword} className="flex justify-between items-center text-sm">
                            <span className="truncate text-slate-600">{keyword}</span>
                            <Badge 
                              variant={density >= 0.5 && density <= 3 ? "default" : "secondary"}
                              className="ml-2"
                            >
                              {density.toFixed(1)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Article History */}
            <Card className="shadow-premium border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2 text-lg font-display">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <span>Recent Articles</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80 w-full">
                  {articles.length === 0 ? (
                    <div className="text-center py-12 space-y-4">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700 mb-1">No articles yet</p>
                        <p className="text-xs text-slate-500">Generate your first premium article!</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {articles.map((article) => (
                        <div
                          key={article.id}
                          className="p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all duration-200 hover:shadow-md group"
                          onClick={() => setSelectedArticle(article)}
                        >
                          <h4 className="font-semibold text-sm text-slate-900 truncate group-hover:text-primary transition-colors">
                            {article.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(article.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                          <div className="flex justify-between items-center mt-3">
                            <Badge 
                              variant="outline" 
                              className="text-xs border-green-200 text-green-700 bg-green-50"
                            >
                              SEO: {article.seoScore}/100
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className="text-xs border-blue-200 text-blue-700 bg-blue-50"
                            >
                              {article.keywords?.length || 0} keywords
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App