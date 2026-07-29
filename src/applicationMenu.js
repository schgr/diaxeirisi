function shouldShowApplicationMenu(version) {
  return String(version || '').toLowerCase().includes('beta');
}

module.exports = {
  shouldShowApplicationMenu
};
