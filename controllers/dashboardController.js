const { Activity, Message, Content, Search } = require('../models/dashboardModel');
const User = require('../models/userModel');

// Helper function to log user activity
const logActivity = async (userId, type, details = '') => {
  try {
    await Activity.create({
        user: userId,
        type,
        details
    });
  } catch (error) {
    console.error('Activity logging error:', error);
  }
};

// @desc    Get dashboard home page content
// @route   GET /api/dashboard/home
// @access  Private
exports.getHomePage = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Log this activity
    await logActivity(userId, 'view', 'dashboard home');
    
    // Get recent activities
    const recentActivities = await Activity.find({ user: userId })
      .sort({ timestamp: -1 })
      .limit(5);
    
    // Get unread message count
    const unreadMessages = await Message.countDocuments({ 
      recipient: userId, 
      isRead: false 
    });
    
    // Get recent content
    const recentContent = await Content.find()
      .sort({ createdAt: -1 })
      .limit(3);
    
    // Create dashboard data object
    const dashboardData = {
      recentActivity: recentActivities,
      quickStats: {
        notifications: 5, // Placeholder - would be from notifications collection
        messages: unreadMessages,
        tasks: 8 // Placeholder - would be from tasks collection
      },
      announcements: recentContent.map(content => ({
        id: content._id,
        title: content.title,
        content: content.description || content.content.substring(0, 100)
      }))
    };
    
    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get search page and results
// @route   GET /api/dashboard/search
// @access  Private
exports.getSearchPage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { query } = req.query;
    
    // Log search activity if query exists
    if (query) {
      await logActivity(userId, 'search', query);
      
      // Save search to history
      await Search.create({
        user: userId,
        query
      });
    }
    
    // Get recent searches
    const recentSearches = await Search.find({ user: userId })
      .sort({ timestamp: -1 })
      .limit(5)
      .select('query');
    
    // Get popular searches (across all users)
    const popularSearches = await Search.aggregate([
      { $group: { _id: '$query', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    let results = [];
    
    if (query) {
      // Search for content matching query
      const contentResults = await Content.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      }).limit(10);
      
      // Search for users matching query
      const userResults = await User.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ]
      }).limit(5);
      
      // Format content results
      const formattedContentResults = contentResults.map(item => ({
        id: item._id,
        type: 'content',
        title: item.title,
        description: item.description,
        matchReason: `Content matches "${query}"`
      }));
      
      // Format user results
      const formattedUserResults = userResults.map(user => ({
        id: user._id,
        type: 'user',
        name: user.name,
        email: user.email,
        matchReason: `User matches "${query}"`
      }));
      
      // Combine results
      results = [...formattedContentResults, ...formattedUserResults];
      
      // Update search record with result count
      await Search.findOneAndUpdate(
        { user: userId, query },
        { results: results.length }
      );
    }
    
    res.status(200).json({
      success: true,
      data: {
        recentSearches: recentSearches.map(s => s.query),
        popularSearches: popularSearches.map(s => s._id),
        results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get user inbox messages
// @route   GET /api/dashboard/inbox
// @access  Private
exports.getInbox = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Log this activity
    await logActivity(userId, 'view', 'inbox');
    
    // Get user messages
    const messages = await Message.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .populate('sender', 'name email')
      .limit(20);
    
    // Count unread messages
    const unreadCount = messages.filter(msg => !msg.isRead).length;
    
    // Format messages
    const formattedMessages = messages.map(msg => ({
      id: msg._id,
      from: {
        id: msg.sender._id,
        name: msg.sender.name
      },
      subject: msg.subject,
      preview: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
      isRead: msg.isRead,
      timestamp: msg.createdAt
    }));
    
    res.status(200).json({
      success: true,
      data: {
        unreadCount,
        messages: formattedMessages
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get personalized "For You" content
// @route   GET /api/dashboard/for-you
// @access  Private
exports.getForYouContent = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Log this activity
    await logActivity(userId, 'view', 'for you content');
    
    // Get user's recent activities to determine interests
    const userActivities = await Activity.find({ user: userId })
      .sort({ timestamp: -1 })
      .limit(50);
    
    // Extract search terms (simplified recommendation engine)
    const searchTerms = await Search.find({ user: userId })
      .select('query')
      .limit(10);
    
    const searchQueries = searchTerms.map(term => term.query);
    
    // Find content that matches user's search history
    // In a real app, this would be a more sophisticated recommendation algorithm
    const recommendedContent = await Content.find({
      $or: [
        { tags: { $in: searchQueries.map(q => new RegExp(q, 'i')) } },
        { title: { $in: searchQueries.map(q => new RegExp(q, 'i')) } }
      ]
    })
    .limit(5)
    .sort({ createdAt: -1 });
    
    // Format recommended content
    const formattedRecommendations = recommendedContent.map(content => ({
      id: content._id,
      type: content.type,
      title: content.title,
      description: content.description,
      readTime: Math.ceil(content.content?.length / 1000) + ' min' // Roughly 1000 chars per minute
    }));
    
    // Get suggested connections (other users)
    // In a real app, this would use a more sophisticated matching algorithm
    const suggestedUsers = await User.find({
      _id: { $ne: userId } // Not the current user
    })
    .limit(3)
    .select('name email');
    
    // Format suggested connections
    const suggestedConnections = suggestedUsers.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      mutualConnections: Math.floor(Math.random() * 5) // Placeholder
    }));
    
    // Get trending content tags
    const trendingTags = await Content.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        recommendedContent: formattedRecommendations,
        suggestedConnections,
        trendingTopics: trendingTags.map(tag => tag._id)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get live content/events
// @route   GET /api/dashboard/live
// @access  Private
exports.getLiveContent = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Log this activity
    await logActivity(userId, 'view', 'live content');
    
    const now = new Date();
    
    // Get current live events
    const currentLiveEvents = await Content.find({
      isLive: true,
      startTime: { $lte: now },
      endTime: { $gt: now }
    }).populate('author', 'name');
    
    // Get upcoming events
    const upcomingEvents = await Content.find({
      isLive: true,
      startTime: { $gt: now }
    })
    .sort({ startTime: 1 })
    .limit(5)
    .populate('author', 'name');
    
    // Get recent recordings (events that have ended)
    const recentRecordings = await Content.find({
      isLive: true,
      endTime: { $lt: now }
    })
    .sort({ endTime: -1 })
    .limit(5)
    .populate('author', 'name');
    
    // Format current live events
    const formattedLiveEvents = currentLiveEvents.map(event => ({
      id: event._id,
      title: event.title,
      host: event.author?.name || 'System',
      participants: Math.floor(Math.random() * 100) + 10, // Placeholder
      startTime: event.startTime,
      estimatedDuration: Math.round((event.endTime - event.startTime) / (1000 * 60)) + ' minutes',
      joinUrl: `/join-event/${event._id}`
    }));
    
    // Format upcoming events
    const formattedUpcomingEvents = upcomingEvents.map(event => ({
      id: event._id,
      title: event.title,
      host: event.author?.name || 'System',
      scheduledTime: event.startTime,
      duration: Math.round((event.endTime - event.startTime) / (1000 * 60)) + ' minutes',
      registerUrl: `/register/${event._id}`
    }));
    
    // Format recordings
    const formattedRecordings = recentRecordings.map(recording => ({
      id: recording._id,
      title: recording.title,
      recordedDate: recording.startTime.toISOString().split('T')[0],
      duration: Math.round((recording.endTime - recording.startTime) / (1000 * 60)) + ' minutes',
      viewUrl: `/recordings/${recording._id}`
    }));
    
    res.status(200).json({
      success: true,
      data: {
        currentLiveEvents: formattedLiveEvents,
        upcomingEvents: formattedUpcomingEvents,
        recentRecordings: formattedRecordings
      }
    });
    } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
    }
};