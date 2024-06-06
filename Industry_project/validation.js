// Common validation code for all forms

document.addEventListener('DOMContentLoaded', function () {
    // Password strength validation
    function validatePasswordStrength(password, meterElement, textElement, validationList) {
        const validations = {
            length: { regex: /.{8,}/, element: validationList.querySelector('#length') },
            uppercase: { regex: /[A-Z]/, element: validationList.querySelector('#uppercase') },
            number: { regex: /\d/, element: validationList.querySelector('#number') },
            special: { regex: /[!@#$%^&*(),.?":{}|<>]/, element: validationList.querySelector('#special') }
        };

        let validCount = 0;

        for (const key in validations) {
            if (validations[key].regex.test(password)) {
                validations[key].element.classList.add('valid');
                validations[key].element.querySelector('.icon').textContent = '✔️';
                validCount++;
            } else {
                validations[key].element.classList.remove('valid');
                validations[key].element.querySelector('.icon').textContent = '❌';
            }
        }

        if (validCount === 1 || validCount === 2) {
            meterElement.className = 'strength-weak';
            textElement.textContent = 'Weak';
        } else if (validCount === 3) {
            meterElement.className = 'strength-medium';
            textElement.textContent = 'Medium';
        } else if (validCount === 4) {
            meterElement.className = 'strength-strong';
            textElement.textContent = 'Strong';
        } else {
            meterElement.className = '';
            textElement.textContent = '';
        }
    }

    // Validate form
    function validateForm(formElement) {
        const inputElements = formElement.querySelectorAll('.validate-input .input100');
        let isValid = true;

        inputElements.forEach(input => {
            if (!validateInput(input)) {
                showValidate(input);
                isValid = false;
            }
        });

        return isValid;
    }

    // Validate input
    function validateInput(input) {
        if (input.name === 'email') {
            return /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(input.value.trim());
        } else {
            return input.value.trim() !== '';
        }
    }

    // Show validation error
    function showValidate(input) {
        const thisAlert = input.parentElement;
        thisAlert.classList.add('alert-validate');
    }

    // Hide validation error
    function hideValidate(input) {
        const thisAlert = input.parentElement;
        thisAlert.classList.remove('alert-validate');
    }

    // Initialize validation for a form
    function initValidation(formId, passwordFieldId, confirmPasswordFieldId, meterElementId, textElementId, validationListId) {
        const formElement = document.getElementById(formId);
        const passwordField = document.getElementById(passwordFieldId);
        const confirmPasswordField = document.getElementById(confirmPasswordFieldId);
        const meterElement = document.getElementById(meterElementId).firstElementChild;
        const textElement = document.getElementById(textElementId);
        const validationList = document.getElementById(validationListId);

        if (passwordField) {
            passwordField.addEventListener('input', () => {
                if (passwordField.value) {
                    validationList.style.display = 'block';
                    validatePasswordStrength(passwordField.value, meterElement, textElement, validationList);
                } else {
                    validationList.style.display = 'none';
                }
            });
        }

        formElement.addEventListener('submit', function (event) {
            if (!validateForm(formElement)) {
                event.preventDefault();
            }
        });

        const inputElements = formElement.querySelectorAll('.validate-input .input100');
        inputElements.forEach(input => {
            input.addEventListener('focus', function () {
                hideValidate(input);
            });
        });
    }

    // Initialize validations for each form
    initValidation('loginForm', '', '', '', '', '');
    initValidation('registerForm', 'password', 'confirmPassword', 'password-strength-meter', 'password-strength-text', 'validationList');
    initValidation('resetForm', 'newPassword', 'confirmPassword', 'password-strength-meter', 'password-strength-text', 'validationList');
});
