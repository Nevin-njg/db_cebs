exports.requireUser = (req, res, next) => {
  if (req.session && req.session.user) return next();
  res.redirect('/auth/login');
};

exports.requireAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  res.redirect('/auth/login');
};

exports.requireGuest = (req, res, next) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin') return res.redirect('/admin/dashboard');
    return res.redirect('/');
  }
  next();
};