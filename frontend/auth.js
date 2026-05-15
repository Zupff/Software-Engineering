

//the purpose of this file is to manage user login authentication

function saveToken(token) {
    localStorage.setItem('authToken', token);     //save login token
}

function getToken() {
    return localStorage.getItem('authToken'); // retrieve saved login token
}

function isLoggedIn() {
    return getToken() !== null; // check if the user has a login token saved to the browser if not return null
}

function logout() {
    localStorage.removeItem('authToken');    //upon logging out remove the token from browser
    window.location.href = 'index.html';   
}

function getAuthHeader() {
    const token = getToken();          //create a header for authorisation using token
    if (token) {
        return { 'Authorization': 'Bearer ' + token };
    }
    return {};
}

function authenticatedFetch(url, options = {}) {
    const authHeader = getAuthHeader();
    const headers = {
        ...authHeader,
        ...(options.headers || {})
    };
    
    const mergedOptions = {
        ...options,
        headers: headers
    };
    
    return fetch(url, mergedOptions).then(response => {
        if (response.status === 401) {
            logout();                      //if the user doesnt have a token log them out
            return;
        }
        return response;
    });
}
