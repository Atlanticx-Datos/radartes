# Known Issues

This document lists known issues with the Oportunidades platform that will be migrated to GitHub Issues once the repository is made public.

## Frontend Issues

### 1. Mobile Responsiveness in Filters

**Description**: The discipline filters don't collapse properly on mobile devices with screen width less than 320px.

**Steps to Reproduce**:
1. Open the site on a mobile device or use browser dev tools to set viewport width to 320px or less
2. Navigate to the filters section
3. Observe that filters overflow the screen

**Priority**: Medium

---

### 2. Sharing Preview Inconsistency

**Description**: The sharing preview in the testing panel sometimes doesn't match the actual shared content on WhatsApp.

**Steps to Reproduce**:
1. Enable the sharing test panel
2. Preview a WhatsApp share
3. Compare with actual WhatsApp share

**Priority**: Low

---

## Backend Issues

### 3. Cache Refresh Timeout

**Description**: The cache refresh operation sometimes times out for large datasets.

**Steps to Reproduce**:
1. Trigger a cache refresh via the admin panel
2. Observe logs for timeout errors when the dataset is larger than usual

**Priority**: High

---

### 4. Auth0 Session Management

**Description**: Users are sometimes logged out unexpectedly when the session should still be valid.

**Steps to Reproduce**:
1. Log in to the platform
2. Leave the tab open but inactive for approximately 30 minutes
3. Return and try to access a protected route

**Priority**: Medium

---

## Feature Requests

### 5. Export to Calendar

**Description**: Add ability to export opportunity deadlines directly to calendar applications (Google Calendar, iCal, etc.)

**Priority**: Medium

---

### 6. Notification System

**Description**: Implement a notification system for users to receive alerts about new opportunities matching their preferences.

**Priority**: High

---

## Performance Issues

### 7. Initial Load Time

**Description**: The initial page load time is slower than desired, especially on mobile networks.

**Steps to Reproduce**:
1. Clear browser cache
2. Open the site on a mobile device with 3G connection
3. Measure time to interactive

**Priority**: High

---

### 8. Search Response Time

**Description**: Complex searches with multiple filters can take more than 3 seconds to return results.

**Steps to Reproduce**:
1. Apply filters for multiple disciplines, countries, and date ranges simultaneously
2. Observe response time

**Priority**: Medium

---

## Note for Migration

When migrating these issues to GitHub Issues:

1. Create appropriate labels (bug, enhancement, performance, etc.)
2. Assign priorities
3. Add more detailed reproduction steps if available
4. Consider creating milestones for grouping related issues 