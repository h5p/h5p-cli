module.exports = (request, response, next, folder) => {
  // A content folder must be one directory name on both POSIX and Windows.
  // Windows also normalizes trailing dots/spaces, including ".. ".
  if (typeof folder !== 'string' || !folder || /[\\/:\0]/.test(folder) || /[. ]$/.test(folder)) {
    response.status(400).json({ error: 'Invalid content folder' });
    return;
  }

  next();
};
