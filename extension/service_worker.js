// Highlight Fact Checker - Service Worker (Manifest V3)
// Creates a context menu item for highlighted text, opens the side panel,
// and passes the claim to the side panel UI.

const MENU_ID = 'factcheck-selection';

chrome.runtime.onInstalled.addListener(() => {
  // Allow users to open the side panel by clicking the extension icon.
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('setPanelBehavior failed:', err));

  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Fact-check: "%s"',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  const claim = (info.selectionText || '').trim();
  if (!claim) return;

  // Best-effort: open the side panel (Chrome 116+).
  // Must be in response to a user gesture (context menu click counts).
  try {
    if (tab?.id != null) {
      await chrome.sidePanel.open({ tabId: tab.id });
    } else if (tab?.windowId != null) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  } catch (e) {
    // Not fatal; user can still open it via the toolbar icon.
    console.warn('sidePanel.open failed:', e);
  }

  // Store last claim so the side panel can read it on load.
  await chrome.storage.session.set({
    lastClaim: claim,
    lastUrl: tab?.url || null,
    lastUpdatedAt: Date.now()
  });

  // Also try to push it to any open side panel right away.
  chrome.runtime.sendMessage({
    type: 'NEW_CLAIM',
    claim,
    url: tab?.url || null
  });
});

// Optional: when user clicks the action icon, try to preload last selection if we can.
// (We can't directly read the page selection from a service worker; that needs a content script.)
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (tab?.id != null) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  } catch (e) {
    console.warn('sidePanel.open (action click) failed:', e);
  }
});
