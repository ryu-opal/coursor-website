const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        default: '其他'
    },
    tags: [{
        type: String
    }],
    date: {
        type: Date,
        default: Date.now
    },
    views: {
        type: Number,
        default: 0
    },
    likes: {
        type: Number,
        default: 0
    },
    coverImage: {
        type: String,
        default: null
    },
    isHot: {
        type: Boolean,
        default: false
    }
});

// 計算文章是否為熱門
postSchema.pre('save', function(next) {
    const now = Date.now();
    const postDate = this.date.getTime();
    
    // 確保文章日期不超過當前時間
    const daysSinceCreation = Math.max(1, (now - postDate) / (1000 * 60 * 60 * 24));
    
    // 計算平均每日瀏覽量
    const avgDailyViews = this.views / daysSinceCreation;
    
    // 設置熱門條件：至少 100 次瀏覽且平均每日瀏覽量 >= 10
    this.isHot = this.views >= 100 && avgDailyViews >= 10;
    
    next();
});

module.exports = mongoose.model('Post', postSchema); 