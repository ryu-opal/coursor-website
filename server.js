const app = require('./app');
const Post = require('./models/Post');
const fetch = require('node-fetch');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const port = process.env.PORT || 3000;

// 配置文件上傳
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'public/uploads';
    // 如果上傳目錄不存在，創建它
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制5MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支援的文件類型'));
    }
  }
});

// 處理媒體上傳
app.post('/upload', upload.single('media'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '沒有上傳文件' });
    }
    const url = '/uploads/' + req.file.filename;
    res.json({ url });
  } catch (err) {
    console.error('文件上傳錯誤：', err);
    res.status(500).json({ error: '文件上傳失敗' });
  }
});

// 修改創建文章的路由以支持文件上傳
app.post('/create', upload.single('cover'), async (req, res) => {
  try {
    const { title, author, content, category, tags } = req.body;
    
    // 處理標籤：將字符串轉換為數組
    const tagArray = tags ? tags.split(',').map(tag => tag.trim()) : [];
    
    const post = new Post({
      title,
      author,
      content,
      category: category || '其他',
      tags: tagArray,
      date: new Date(),
      views: 0,
      likes: 0,
      coverImage: req.file ? '/uploads/' + req.file.filename : null
    });
    
    const savedPost = await post.save();
    console.log('新文章已創建：', savedPost);
    res.redirect('/main');
  } catch (err) {
    console.error('創建文章時出錯：', err);
    res.status(500).send('創建文章時出錯');
  }
});

// 主頁 - 包含排序功能
app.get('/main', async (req, res) => {
  try {
    const { sort = 'latest' } = req.query;
    let posts;
    
    console.log('正在獲取文章列表，排序方式：', sort);
    
    switch (sort) {
      case 'hot':
        // 獲取熱門文章（平均每天瀏覽量超過10的文章）
        posts = await Post.find();
        console.log('找到的所有文章：', posts.length);
        posts = posts.filter(post => post.isHot);
        console.log('熱門文章數量：', posts.length);
        break;
      case 'views':
        // 按瀏覽量排序
        posts = await Post.find().sort({ views: -1 });
        console.log('按瀏覽量排序的文章數量：', posts.length);
        break;
      case 'latest':
      default:
        // 按創建時間排序
        posts = await Post.find().sort({ date: -1 });
        console.log('按時間排序的文章數量：', posts.length);
    }
    
    console.log('準備渲染頁面，文章數量：', posts.length);
    res.render('main', { posts, currentSort: sort });
  } catch (err) {
    console.error('獲取文章列表時出錯：', err);
    res.status(500).send('服務器錯誤');
  }
});

// 根路由 - 重定向到主頁
app.get('/', (req, res) => {
  res.redirect('/main' + (req.query.sort ? `?sort=${req.query.sort}` : ''));
});

// 部落格頁面 - 包含文章詳情和瀏覽計數
app.get('/blog', async (req, res) => {
  try {
    const { sort = 'latest' } = req.query;
    let posts;
    
    console.log('正在獲取部落格文章列表，排序方式：', sort);
    
    // 驗證排序參數
    const validSortOptions = ['latest', 'views', 'likes'];
    if (!validSortOptions.includes(sort)) {
      return res.status(400).render('blog', { 
        error: '無效的排序選項',
        posts: [],
        sort: 'latest'
      });
    }
    
    switch (sort) {
      case 'views':
        posts = await Post.find().sort({ views: -1 });
        console.log('按瀏覽量排序的文章數量：', posts.length);
        break;
      case 'likes':
        posts = await Post.find().sort({ likes: -1 });
        console.log('按讚數排序的文章數量：', posts.length);
        break;
      case 'latest':
      default:
        posts = await Post.find().sort({ date: -1 });
        console.log('按時間排序的文章數量：', posts.length);
    }
    
    console.log('準備渲染部落格頁面，文章數量：', posts.length);
    res.render('blog', { 
      posts, 
      sort,
      error: null // 明確設置 error 為 null
    });
  } catch (err) {
    console.error('獲取文章列表時出錯：', err);
    res.status(500).render('blog', { 
      error: '獲取文章列表時出錯',
      posts: [],
      sort: 'latest'
    });
  }
});

// 單篇文章頁面 - 增加瀏覽次數
app.get('/post/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).send('文章未找到');
    }
    
    // 增加瀏覽次數
    post.views += 1;
    await post.save();
    
    res.render('post', { post });
  } catch (err) {
    res.status(500).send('服務器錯誤');
  }
});

// 創作頁面
app.get('/create', (req, res) => {
  res.render('create');
});

// 點讚功能
app.post('/post/:id/like', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: '文章未找到' });
    }
    
    post.likes += 1;
    await post.save();
    
    res.json({ likes: post.likes });
  } catch (err) {
    res.status(500).json({ error: '服務器錯誤' });
  }
});

// 按分類獲取文章
app.get('/category/:category', async (req, res) => {
  try {
    const posts = await Post.find({ category: req.params.category })
                           .sort({ createdAt: -1 });
    res.render('category', { 
      posts, 
      category: req.params.category 
    });
  } catch (err) {
    res.status(500).send('服務器錯誤');
  }
});

// 按標籤獲取文章
app.get('/tag/:tag', async (req, res) => {
  try {
    const posts = await Post.find({ tags: req.params.tag })
                           .sort({ createdAt: -1 });
    res.render('tag', { 
      posts, 
      tag: req.params.tag 
    });
  } catch (err) {
    res.status(500).send('服務器錯誤');
  }
});

// 股票圖表頁面
app.get('/stock', (req, res) => {
  res.render('stock');
});

// 啟動服務器
app.listen(port, () => {
  console.log(`網站運行在 http://localhost:${port}`);
});