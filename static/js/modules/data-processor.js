export function processDestacarData(rawData) {
    try {
        window.processedDestacarData = rawData.map(function(item) {
            return Object.assign({}, item, {
                url_base: item.url_base || new URL(item.url).hostname.replace('www.', '')
            });
        });
        console.log('Processed data:', window.processedDestacarData);
    } catch (error) {
        console.error('Error processing destacar data:', error);
        window.processedDestacarData = [];
    }
} 