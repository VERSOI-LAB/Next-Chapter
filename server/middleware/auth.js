const { supabaseAdmin } = require('../lib/supabase');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: '유효하지 않은 세션입니다. 다시 로그인해주세요.' });

  req.user = data.user;
  req.token = token;
  next();
}

async function requireAdmin(req, res, next) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (error || !['admin', 'super_admin'].includes(profile?.role)) {
    return res.status(403).json({ error: '관리자만 접근할 수 있습니다.' });
  }
  req.adminRole = profile.role;
  next();
}

async function requireSuperAdmin(req, res, next) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (error || profile?.role !== 'super_admin') {
    return res.status(403).json({ error: '최고관리자만 접근할 수 있습니다.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireSuperAdmin };
