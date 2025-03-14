# Testing Sharing Functionality

This document provides instructions on how to test the sharing functionality in the Radartes application.

## Overview

The sharing functionality allows users to share opportunities across various platforms including:
- WhatsApp
- Twitter/X
- LinkedIn
- Facebook
- Email
- Copy to clipboard

## Testing Methods

### 1. Using the Browser Console

The `SharingModule` includes a built-in testing method that can be accessed from the browser console:

1. Open the application in your browser
2. Open the browser console (F12 or Ctrl+Shift+I)
3. Type: `SharingModule.testSharing()`
4. This will return an object with test methods for each sharing platform

You can then test specific sharing methods:
```javascript
// Test WhatsApp sharing
SharingModule.testSharing().shareToWhatsApp()

// Test Twitter sharing
SharingModule.testSharing().shareToTwitter()

// Test LinkedIn sharing
SharingModule.testSharing().shareToLinkedIn()

// Test Email sharing
SharingModule.testSharing().shareViaEmail()

// Test Copy to clipboard
SharingModule.testSharing().copyToClipboard()
```

### 2. Manual Testing with Real Opportunities

For more comprehensive testing:

1. Navigate to an opportunity detail page
2. Click on the share button to open the sharing modal
3. Test each sharing option in the modal
4. Verify that the shared content appears correctly on each platform

### 3. Testing Specific Formatting

To test how the content is formatted for different platforms:

```javascript
// Get the test opportunity object
const testOpp = SharingModule.testSharing().opportunity

// View WhatsApp formatted text
console.log(SharingModule.formatOpportunityDetails(testOpp, 'whatsapp'))

// View standard formatted text
console.log(SharingModule.formatOpportunityDetails(testOpp))
```

## Common Issues and Troubleshooting

### WhatsApp Emoji Display

WhatsApp may not display emojis correctly when shared from the web. The module automatically uses plain text formatting for WhatsApp to avoid this issue.

### LinkedIn Sharing

LinkedIn sharing requires proper Open Graph meta tags on the target page for optimal preview. Ensure the following meta tags are present:

```html
<meta property="og:title" content="Opportunity Title">
<meta property="og:description" content="Opportunity description">
<meta property="og:image" content="URL to image">
<meta property="og:url" content="URL to opportunity">
```

### Clipboard API Support

The module uses the modern Clipboard API with a fallback to the older `document.execCommand('copy')` method. If copying fails:

1. Check browser console for errors
2. Verify that the page is being served over HTTPS (required for Clipboard API)
3. Test in different browsers to isolate the issue

## Updating Sharing Functionality

When making changes to the sharing functionality:

1. Always test across multiple browsers (Chrome, Firefox, Safari)
2. Test on both desktop and mobile devices
3. Verify that the content appears correctly on each platform
4. Update this documentation if the testing procedure changes 