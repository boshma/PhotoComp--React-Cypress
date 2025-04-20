import axios from 'axios';

// Determine API base URL based on Vite mode
const isProduction = import.meta.env.MODE === 'production';
const apiBaseUrl = isProduction
    ? 'http://52.89.156.167:3000' // <--- Production API URL (Hardcoded)
    : 'http://localhost:3000'; // <--- Development API URL (Hardcoded)

// Log the mode and the determined API URL for easier debugging
console.log(`[Axios Setup] Mode: ${import.meta.env.MODE}, Connecting to API at: ${apiBaseUrl}`);

const AXIOS_DEFAULTS = {
    baseURL: apiBaseUrl,
    headers: {
        'Content-Type': 'application/json',
    },
};

// No Auth instance - typically used for public endpoints like login/register
export const noAuthInstance = axios.create(AXIOS_DEFAULTS);

// Instance with Auth interceptor
const axiosInstance = axios.create(AXIOS_DEFAULTS);

axiosInstance.interceptors.request.use(
    config => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    error => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
    response => response,
    error => {
        console.error('API error encountered:', error);

        // Enhanced error logging
        if (error.response) {
            console.error(`API Response Error: Status ${error.response.status}`, error.response.data);
        } else if (error.request) {
            console.error('API No Response Error. Request details:', error.request);
            // Could be a network issue or CORS problem preventing the response
            if (error.message && error.message.toLowerCase().includes('network error')) {
                console.warn("Network error detected. Check API server status and CORS configuration.");
            }
        } else {
            console.error('API Request Setup Error:', error.message);
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;