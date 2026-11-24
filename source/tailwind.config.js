module.exports = {
  content: ['./portal-app.jsx'],
  theme: { extend: {
    colors: {
      bg:'var(--bg)', surface:'var(--surface)', sunk:'var(--sunk)', ink:'var(--ink)', muted:'var(--muted)', line:'var(--line)',
      maple:'var(--maple)', maplesoft:'var(--maple-soft)', rope:'var(--rope)', ropesoft:'var(--rope-soft)',
      ok:'var(--ok)', oksoft:'var(--ok-soft)', warn:'var(--warn)', warnsoft:'var(--warn-soft)'
    },
    fontFamily: {
      display: ['"Barlow Condensed"', '"Arial Narrow"', 'Arial', 'sans-serif'],
      sans: ['Barlow', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
    }
  } }
};
