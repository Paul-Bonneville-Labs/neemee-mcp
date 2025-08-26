/**
 * Utility functions for extracting and working with domains from URLs
 */

/**
 * Extracts the domain from a given URL
 * @param url - The URL to extract domain from
 * @returns The domain (hostname) or null if URL is invalid
 * 
 * @example
 * extractDomain('https://www.example.com/path') // returns 'www.example.com'
 * extractDomain('http://subdomain.example.com:8080/page') // returns 'subdomain.example.com'
 * extractDomain('invalid-url') // returns null
 */
export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // Invalid URL format
    return null;
  }
}

/**
 * Extracts the root domain (without subdomains) from a given URL
 * @param url - The URL to extract root domain from
 * @returns The root domain or null if URL is invalid
 * 
 * @example
 * extractRootDomain('https://www.example.com/path') // returns 'example.com'
 * extractRootDomain('http://subdomain.example.com:8080/page') // returns 'example.com'
 */
export function extractRootDomain(url: string | null | undefined): string | null {
  const domain = extractDomain(url);
  if (!domain) return null;
  
  // Split by dots and take last two parts for most cases
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  
  // Handle common cases like .co.uk, .com.au, etc.
  // For simplicity, we'll just take the last two parts
  return parts.slice(-2).join('.');
}

/**
 * Gets a display-friendly domain name from a URL
 * Removes 'www.' prefix if present
 * @param url - The URL to get display domain from
 * @returns The display domain or null if URL is invalid
 * 
 * @example
 * getDisplayDomain('https://www.example.com/path') // returns 'example.com'
 * getDisplayDomain('http://subdomain.example.com/page') // returns 'subdomain.example.com'
 */
export function getDisplayDomain(url: string | null | undefined): string | null {
  const domain = extractDomain(url);
  if (!domain) return null;
  
  // Remove 'www.' prefix if present
  return domain.startsWith('www.') ? domain.slice(4) : domain;
}