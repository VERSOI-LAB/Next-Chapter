require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const journeyRoutes = require('./routes/journeys');
const applicationRoutes = require('./routes/applications');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');
const photoRoutes = require('./routes/photos');
const verificationRoutes = require('./routes/verifications');
const storyRoutes = require('./routes/story');
const passportRoutes = require('./routes/passport');
const contactRoutes = require('./routes/contact');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.hostname === 'admin.versoi.co.kr') return res.redirect('/admin.html');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use('/api/auth', authRoutes);
app.use('/api/journeys', journeyRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/verifications', verificationRoutes);
app.use('/api/story', storyRoutes);
app.use('/api/passport', passportRoutes);
app.use('/api/contact', contactRoutes);

app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`NEXT CHAPTER server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
