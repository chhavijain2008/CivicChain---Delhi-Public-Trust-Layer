// CivicChain — theme toggle (light / dark)
(function(){
  var STORAGE_KEY = 'civicchain_theme';
  var root = document.documentElement;
  var btn = document.getElementById('themeToggle');

  function currentTheme(){
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function reflect(theme){
    if(!btn) return;
    var isLight = theme === 'light';
    btn.setAttribute('aria-pressed', String(isLight));
    btn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
    btn.title = isLight ? 'Switch to dark theme' : 'Switch to light theme';
  }

  function setTheme(theme){
    root.setAttribute('data-theme', theme);
    try{ localStorage.setItem(STORAGE_KEY, theme); }catch(e){}
    reflect(theme);
  }

  // Sync toggle UI with whatever the anti-flicker inline script already applied.
  reflect(currentTheme());

  var menu=document.querySelector('.menu-btn');
  if(menu){menu.addEventListener('click',function(){var nav=document.getElementById('nav');if(nav){nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(nav.classList.contains('open')));}});}

  if(btn){
    btn.addEventListener('click', function(){
      setTheme(currentTheme() === 'light' ? 'dark' : 'light');
    });
  }

  // Keep the creator page discoverable from every CivicChain surface.
  if(nav && !nav.querySelector('a[data-creator-link]')){
    var creatorLink=document.createElement('a');
    creatorLink.href='meet-the-creators-cc.html';
    creatorLink.textContent='Creators';
    creatorLink.setAttribute('data-creator-link','true');
    if(/meet-the-creators\.html$/.test(window.location.pathname)) creatorLink.className='active-nav';
    nav.insertBefore(creatorLink, btn || null);
  }
})();
