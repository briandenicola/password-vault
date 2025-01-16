import Axios from 'axios';

const API_ENDPOINT = '/api/passwords';

const createEmptySecurityQuestion = () => ({
    question:   "",
    answer:     "",
});

const emptyPassword = {
    accountName:        "",
    siteName:           "",
    currentPassword:    "",
    notes:              "",
    createdBy:          "",
    lastModifiedBy:     "",
    isDeleted:          false,
    securityQuestions: Array(3).fill(null).map(createEmptySecurityQuestion),
};

export default {

    getAll() {
        return Axios.get(API_ENDPOINT);
    },
    get(id) {
        try {
            return Axios.get(`${API_ENDPOINT}/${id}`);
        } catch (error) {
            console.error(`Error fetching password with id ${id}:`, error);
            throw error;
        }
    },
    create(data) {
        return Axios.post(API_ENDPOINT, data);
    },
    update(id, data) {
        return Axios.put(`${API_ENDPOINT}/${id}`, data);
    },
    delete(id) {
        return Axios.delete(`${API_ENDPOINT}/${id}`);
    },
    newPassword() {
        return emptyPassword;
    }
};
