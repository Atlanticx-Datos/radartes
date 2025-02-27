export function processDestacarData(rawData) {
    try {
        console.log('Processing destacar data, raw data:', rawData);
        console.log('Raw data type:', typeof rawData);
        console.log('Raw data length:', Array.isArray(rawData) ? rawData.length : 'not an array');
        
        if (!Array.isArray(rawData) || rawData.length === 0) {
            console.warn('Raw destacar data is empty or not an array');
            window.processedDestacarData = [];
            return;
        }
        
        window.processedDestacarData = rawData.map(function(item) {
            try {
                // First check if url_base already exists
                if (item.url_base) {
                    return item;
                }
                
                // If not, try to extract it from the URL
                let url_base = '';
                if (item.url) {
                    try {
                        url_base = new URL(item.url).hostname.replace('www.', '');
                    } catch (urlError) {
                        console.warn('Error parsing URL:', item.url, urlError);
                        // Try a simple regex extraction as fallback
                        const match = item.url.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
                        url_base = match ? match[1] : '';
                    }
                }
                
                return Object.assign({}, item, { url_base });
            } catch (itemError) {
                console.error('Error processing item:', item, itemError);
                return item; // Return the original item to avoid breaking the array
            }
        });
        
        console.log('Processed destacar data:', window.processedDestacarData.length, 'items');
        
        // Immediately initialize DestacarModule if it exists
        if (window.DestacarModule && typeof window.DestacarModule.init === 'function') {
            console.log('Directly initializing DestacarModule from processDestacarData');
            window.DestacarModule.init(window.processedDestacarData);
        } else {
            console.warn('DestacarModule not available for initialization');
            
            // Set a timeout to try again in case the module is loaded later
            setTimeout(() => {
                if (window.DestacarModule && typeof window.DestacarModule.init === 'function') {
                    console.log('Initializing DestacarModule after delay');
                    window.DestacarModule.init(window.processedDestacarData);
                } else {
                    console.error('DestacarModule still not available after delay');
                }
            }, 500);
        }
    } catch (error) {
        console.error('Error processing destacar data:', error);
        window.processedDestacarData = [];
    }
} 