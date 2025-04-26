const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 使用 app.js 中的上傳配置
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = path.join(__dirname, '../public/uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支援的文件類型'));
        }
    }
});

// 首頁路由
router.get('/', (req, res) => {
    res.redirect('/main' + (req.query.sort ? `?sort=${req.query.sort}` : ''));
});

// 主頁路由
router.get('/main', async (req, res) => {
    try {
        const { sort = 'latest' } = req.query;
        let posts;
        
        switch (sort) {
            case 'hot':
                posts = await Post.find();
                posts = posts.filter(post => post.isHot);
                break;
            case 'views':
                posts = await Post.find().sort({ views: -1 });
                break;
            default:
                posts = await Post.find().sort({ date: -1 });
        }
        
        res.render('main', { posts, currentSort: sort });
    } catch (err) {
        res.status(500).send('服務器錯誤');
    }
});

// 部落格列表路由
router.get('/blog', async (req, res) => {
    try {
        const { sort = 'latest' } = req.query;
        const validSortOptions = ['latest', 'views', 'likes'];
        
        if (!validSortOptions.includes(sort)) {
            return res.status(400).render('blog', { 
                error: '無效的排序選項',
                posts: [],
                sort: 'latest'
            });
        }
        
        let posts;
        switch (sort) {
            case 'views':
                posts = await Post.find().sort({ views: -1 });
                break;
            case 'likes':
                posts = await Post.find().sort({ likes: -1 });
                break;
            default:
                posts = await Post.find().sort({ date: -1 });
        }
        
        res.render('blog', { posts, sort, error: null });
    } catch (err) {
        res.status(500).render('blog', { 
            error: '獲取文章列表時出錯',
            posts: [],
            sort: 'latest'
        });
    }
});

// 文章詳情路由
router.get('/post/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).send('文章未找到');
        }
        post.views += 1;
        await post.save();
        res.render('post', { post });
    } catch (err) {
        res.status(500).send('服務器錯誤');
    }
});

// 創作頁面路由
router.get('/create', (req, res) => {
    res.render('create');
});

// 創建文章路由
router.post('/create', upload.single('cover'), async (req, res) => {
    try {
        const { title, author, content, category, tags } = req.body;
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
        
        await post.save();
        res.redirect('/main');
    } catch (err) {
        res.status(500).send('創建文章時出錯');
    }
});

// 點讚功能路由
router.post('/post/:id/like', async (req, res) => {
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

// 媒體上傳路由
router.post('/upload', upload.single('media'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '沒有上傳文件' });
        }
        const url = '/uploads/' + req.file.filename;
        res.json({ url });
    } catch (err) {
        res.status(500).json({ error: '文件上傳失敗' });
    }
});

// 分類頁面路由
router.get('/category/:category', async (req, res) => {
    try {
        const posts = await Post.find({ category: req.params.category })
                               .sort({ createdAt: -1 });
        res.render('category', { posts, category: req.params.category });
    } catch (err) {
        res.status(500).send('服務器錯誤');
    }
});

// 標籤頁面路由
router.get('/tag/:tag', async (req, res) => {
    try {
        const posts = await Post.find({ tags: req.params.tag })
                               .sort({ createdAt: -1 });
        res.render('tag', { posts, tag: req.params.tag });
    } catch (err) {
        res.status(500).send('服務器錯誤');
    }
});

// 股票圖表路由
router.get('/stock', (req, res) => {
    res.render('stock');
});

module.exports = router; 