# Enhanced Sharing Functionality - Testing Guide

This document provides guidance on testing the enhanced sharing functionality for the Oportunidades web application.

## Overview

The enhanced sharing functionality allows users to share opportunities with more detailed information, including:

- Opportunity name
- Country
- Discipline
- Closing date
- Registration fee information
- URL
- Brand signature

## Testing Environment

A special testing environment has been created to help test the sharing functionality across different platforms. This testing environment is automatically enabled in development mode (localhost) or when the URL parameter `test=true` is added.

### Enabling the Testing Environment

1. In development mode (localhost), the testing panel will appear automatically
2. In production, add `?test=true` to the URL to enable the testing panel
3. Alternatively, open the browser console and run: `localStorage.setItem('enableSharingTest', 'true')` and refresh the page

### Using the Testing Panel

The testing panel appears as a "Test Sharing" button in the bottom right corner of the screen. Clicking this button opens a panel with:

- Input fields to customize the opportunity data
- A preview of how the shared message will look
- Buttons to test sharing on different platforms

## Testing Across Platforms

### WhatsApp

1. Click the "WhatsApp" button in the testing panel or use the share dropdown in the opportunity card
2. Verify that WhatsApp opens with the formatted message including:
   - Opportunity name with 📢 emoji
   - Country with 📍 emoji
   - Discipline with 🎨 emoji
   - Closing date with 📅 emoji
   - Registration fee with ✅ or 💰 emoji
   - URL
   - Brand signature ("Compartido desde Radartes")

### Email

1. Click the "Email" button in the testing panel or use the share dropdown
2. Verify that your email client opens with:
   - Subject: Opportunity name
   - Body: Formatted message with all details

### LinkedIn

1. Click the "LinkedIn" button in the testing panel or use the share dropdown
2. Verify that LinkedIn sharing opens with the URL pre-filled
   - Note: LinkedIn doesn't support custom message text in their sharing API

### Copy to Clipboard

1. Click the "Copy" button in the testing panel
2. Paste the content somewhere to verify it contains all the expected information

## Troubleshooting

### Common Issues

1. **WhatsApp doesn't open**: Some browsers block opening WhatsApp. Try using a different browser or the WhatsApp desktop app.
2. **Message formatting issues**: If emojis or line breaks don't appear correctly, check the browser's encoding settings.
3. **Clipboard access denied**: Some browsers require explicit permission to access the clipboard. Check browser permissions.

### Reporting Issues

If you encounter issues with the sharing functionality, please report them with:

1. The platform you were trying to share to (WhatsApp, Email, etc.)
2. The device and browser you were using
3. A screenshot of the issue if possible
4. Any error messages from the browser console

## Implementation Details

The sharing functionality is implemented in the following files:

- `static/js/modules/sharing.js`: Main sharing module
- `static/js/modules/sharing-test.js`: Testing utilities
- `static/js/site.js`: Integration with the main application
- `templates/_search_results.html`: Share buttons in the UI

The implementation uses feature detection to ensure compatibility across different browsers and platforms.

## Future Improvements

Planned improvements for the sharing functionality include:

1. Adding more sharing platforms (Facebook, Twitter, etc.)
2. Customizable sharing templates
3. Analytics to track sharing engagement
4. Image sharing for platforms that support it 