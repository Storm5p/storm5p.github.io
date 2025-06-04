document.addEventListener('DOMContentLoaded', () => {
        let audioCtx = null;

        function initAudioContextOnce() {
            if (!audioCtx) {
                try {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                } catch (e) {
                    console.warn("Web Audio API não suportada.", e);
                    return;
                }
            }
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume().catch(err => console.warn("Erro ao resumir AudioContext:", err));
            }
            document.body.removeEventListener('click', initAudioContextOnce);
            document.body.removeEventListener('touchstart', initAudioContextOnce);
        }
        document.body.addEventListener('click', initAudioContextOnce, { once: true });
        document.body.addEventListener('touchstart', initAudioContextOnce, { once: true });

        function playKeyClickSound(type = 'number') {
            if (!audioCtx || audioCtx.state !== 'running') {
                if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
                if (!audioCtx || audioCtx.state !== 'running') return;
            }

            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            let frequency = 800, volume = 0.06, decay = 0.05;
            switch (type) {
                case 'number': case 'decimal': frequency = 900; volume = 0.05; decay = 0.04; break;
                case 'operator': frequency = 700; volume = 0.07; decay = 0.06; break;
                case 'action': case 'calculate': frequency = 600; volume = 0.08; decay = 0.08; break;
                case 'clear': case 'all-clear': case 'backspace': frequency = 500; volume = 0.07; decay = 0.07; break;
                case 'tab': frequency = 1000; volume = 0.04; decay = 0.03; break;
            }
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.005);
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.005 + decay);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.005 + decay + 0.01);
        }

        const formatCurrency = (value) => `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
        const formatPercentage = (value) => `${Number(value).toFixed(1).replace('.', ',')}%`;
        const getErrorDiv = (id) => document.getElementById(id + "ErrorMessage");
        const getResultsArea = (id) => document.getElementById(id + "ResultsArea");
        const clearError = (errorDiv) => { if (errorDiv) { errorDiv.textContent = ''; errorDiv.style.display = 'none';}};
        const showError = (errorDiv, message, inputToFocus = null) => {
            if (errorDiv) { errorDiv.textContent = message; errorDiv.style.display = 'block';}
            if (inputToFocus) inputToFocus.focus();
        };
        const sanitizeNumericInput = (value) => value.replace(',', '.');

        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        function switchTab(targetTabId) {
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.tab === targetTabId) btn.classList.add('active');
            });
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${targetTabId}Content`) content.classList.add('active');
            });
        }
        tabButtons.forEach(button => button.addEventListener('click', () => { playKeyClickSound('tab'); switchTab(button.dataset.tab); }));

        // --- DISCOUNT CALCULATOR ---
        const originalPriceInput = document.getElementById('originalPrice');
        const discountPercentageInput = document.getElementById('discountPercentage');
        const calculateDiscountBtn = document.getElementById('calculateDiscountBtn');
        const resetDiscountBtn = document.getElementById('resetDiscountBtn');
        const discountResultsArea = getResultsArea('discount');
        const displayOriginalPrice = document.getElementById('displayOriginalPrice');
        const displayAmountSaved = document.getElementById('displayAmountSaved');
        const displayPercentageSaved = document.getElementById('displayPercentageSaved');
        const displayFinalPrice = document.getElementById('displayFinalPrice');
        const discountErrorDiv = getErrorDiv('discount');

        if(calculateDiscountBtn) calculateDiscountBtn.addEventListener('click', () => {
            clearError(discountErrorDiv);
            const originalPrice = parseFloat(sanitizeNumericInput(originalPriceInput.value));
            const discountPercentage = parseFloat(sanitizeNumericInput(discountPercentageInput.value));
            if (isNaN(originalPrice) || originalPrice <= 0) {
                showError(discountErrorDiv, 'Insira um valor original válido.', originalPriceInput);
                discountResultsArea.classList.remove('visible'); return;
            }
            if (isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
                showError(discountErrorDiv, 'Insira um percentual de desconto válido (0 a 100).', discountPercentageInput);
                discountResultsArea.classList.remove('visible'); return;
            }
            const savedAmount = (originalPrice * discountPercentage) / 100;
            const finalPrice = originalPrice - savedAmount;
            displayOriginalPrice.textContent = formatCurrency(originalPrice);
            displayAmountSaved.textContent = formatCurrency(savedAmount);
            displayPercentageSaved.textContent = `-${formatPercentage(discountPercentage)}`;
            displayFinalPrice.textContent = formatCurrency(finalPrice);
            discountResultsArea.classList.add('visible');
        });
        if(resetDiscountBtn) resetDiscountBtn.addEventListener('click', () => {
            clearError(discountErrorDiv);
            originalPriceInput.value = ''; discountPercentageInput.value = '';
            discountResultsArea.classList.remove('visible');
            if (originalPriceInput) originalPriceInput.focus();
        });

        // --- STANDARD CALCULATOR ---
        const stdDisplay = document.getElementById('standardCalculatorDisplay');
        const stdHistoryDisplay = document.getElementById('standardCalculatorHistory');
        const stdButtons = document.querySelector('.standard-calculator-buttons');
        let calculatorState = { displayValue: '0', firstOperand: null, waitingForSecondOperand: false, operator: null, history: '' };

        function updateStdDisplay() {
            stdDisplay.textContent = calculatorState.displayValue.replace('.', ',');
            let historyText = calculatorState.history.replace(/\./g, ','); // Substitui todos os pontos por vírgulas para exibição
            if (historyText.length > 28) { // Limite para o histórico
                historyText = "..." + historyText.slice(historyText.length - 25);
            }
            stdHistoryDisplay.textContent = historyText;
        }

        function inputDigit(digit) {
            const { displayValue, waitingForSecondOperand } = calculatorState;
            if (calculatorState.displayValue.replace(/[,.]/g, '').length >= 15 && !waitingForSecondOperand && !(displayValue === '0' && digit !== '.')) return;

            if (waitingForSecondOperand) {
                calculatorState.displayValue = digit;
                calculatorState.waitingForSecondOperand = false;
            } else {
                 if(displayValue === '0' && digit === '.') calculatorState.displayValue = '0.'; // Evita "0." se já for "0"
                 else if (displayValue === '0') calculatorState.displayValue = digit;
                 else calculatorState.displayValue += digit;
            }
            if (calculatorState.displayValue.length > 15) calculatorState.displayValue = calculatorState.displayValue.slice(0, 15);

            if (!calculatorState.operator) {
                 calculatorState.history = calculatorState.displayValue;
            } else {
                calculatorState.history = `${formatOperandForHistory(calculatorState.firstOperand)} ${calculatorState.operator} ${calculatorState.displayValue}`;
            }
        }

        function inputDecimal(dot) {
            if (calculatorState.displayValue.replace(/[,.]/g, '').length >= 14) return;
            if (calculatorState.waitingForSecondOperand) {
                calculatorState.displayValue = '0.';
                calculatorState.waitingForSecondOperand = false;
            } else if (!calculatorState.displayValue.includes(dot)) {
                calculatorState.displayValue += dot;
            }
            if (calculatorState.displayValue.length > 15) calculatorState.displayValue = calculatorState.displayValue.slice(0, 15);

            if (!calculatorState.operator) {
                 calculatorState.history = calculatorState.displayValue;
            } else {
                calculatorState.history = `${formatOperandForHistory(calculatorState.firstOperand)} ${calculatorState.operator} ${calculatorState.displayValue}`;
            }
        }

        function formatOperandForHistory(operand) {
            if (operand === null) return '';
            // Formata para ter no máximo 7 casas decimais e usa ponto para consistência interna
            let numStr = String(parseFloat(Number(operand).toFixed(7)));
            return numStr;
        }

        function handleOperator(nextOperator) {
            const { firstOperand, displayValue, operator, waitingForSecondOperand } = calculatorState;
            const inputValue = parseFloat(displayValue.replace(',', '.'));

            if (operator && waitingForSecondOperand) {
                calculatorState.operator = nextOperator;
                if (firstOperand !== null) calculatorState.history = `${formatOperandForHistory(firstOperand)} ${nextOperator}`;
                // updateStdDisplay(); // Será chamado no final do listener principal
                return;
            }

            if (firstOperand === null) {
                if (!isNaN(inputValue)) calculatorState.firstOperand = inputValue;
                else return;
            } else if (!waitingForSecondOperand) {
                if (operator && !isNaN(inputValue)) {
                    const result = performCalculation[operator](firstOperand, inputValue);
                     if (result === 'Error') {
                        calculatorState.displayValue = 'Erro'; calculatorState.history = '';
                        calculatorState.firstOperand = null; calculatorState.operator = null;
                        calculatorState.waitingForSecondOperand = false; 
                        updateStdDisplay(); // Atualiza para mostrar "Erro" imediatamente
                        return;
                    }
                    calculatorState.firstOperand = parseFloat(result.toFixed(7));
                } else if (!isNaN(inputValue)) calculatorState.firstOperand = inputValue; // Caso: resultado anterior, depois número, depois operador
            }

            calculatorState.operator = nextOperator;
            calculatorState.waitingForSecondOperand = true;
            if (calculatorState.firstOperand !== null) calculatorState.history = `${formatOperandForHistory(calculatorState.firstOperand)} ${calculatorState.operator}`;
            calculatorState.displayValue = '0';
        }

        const performCalculation = {
            '/': (firstOperand, secondOperand) => (secondOperand === 0 ? 'Error' : firstOperand / secondOperand),
            '*': (firstOperand, secondOperand) => firstOperand * secondOperand,
            '+': (firstOperand, secondOperand) => firstOperand + secondOperand,
            '-': (firstOperand, secondOperand) => firstOperand - secondOperand,
        };

        function resetCalculator() {
            calculatorState.displayValue = '0'; calculatorState.firstOperand = null;
            calculatorState.waitingForSecondOperand = false; calculatorState.operator = null;
            calculatorState.history = '';
        }

        function clearEntry() {
            calculatorState.displayValue = '0';
            if (calculatorState.operator && calculatorState.firstOperand !== null) {
                 if(calculatorState.waitingForSecondOperand){
                    // Mantém "X op" no histórico, displayValue já é 0
                 } else { // Estava digitando o segundo operando e limpou
                     calculatorState.history = `${formatOperandForHistory(calculatorState.firstOperand)} ${calculatorState.operator}`;
                 }
                 calculatorState.waitingForSecondOperand = false; // Pronto para digitar o segundo operando (novamente)
            } else { // Estava digitando o primeiro operando
                calculatorState.history = '';
            }
        }

        function backspace() {
            const { displayValue, operator, firstOperand, waitingForSecondOperand } = calculatorState;

            if (waitingForSecondOperand && displayValue === '0' && operator && firstOperand !== null) {
                // Usuário pressionou operador (histórico "X op", display "0") e quer apagar o operador
                calculatorState.displayValue = String(firstOperand).replace('.', ','); // Mostra o primeiro operando formatado
                calculatorState.history = formatOperandForHistory(firstOperand); // Histórico volta para o primeiro operando
                calculatorState.operator = null;
                calculatorState.waitingForSecondOperand = false;
            } else if (!waitingForSecondOperand && displayValue !== '0') {
                // Apagando dígitos do número atual (seja primeiro ou segundo operando)
                calculatorState.displayValue = displayValue.length > 1 ? displayValue.slice(0, -1) : '0';
                if (!operator) { // Editando o primeiro operando
                    calculatorState.history = calculatorState.displayValue === '0' ? '' : calculatorState.displayValue;
                } else { // Editando o segundo operando
                    calculatorState.history = `${formatOperandForHistory(firstOperand)} ${operator} ${calculatorState.displayValue === '0' ? '' : calculatorState.displayValue.trim()}`;
                    if (calculatorState.displayValue === '0') { // Se o segundo operando virou '0'
                         calculatorState.history = `${formatOperandForHistory(firstOperand)} ${operator}`;
                    }
                }
            } else if (!waitingForSecondOperand && displayValue === '0' && operator && firstOperand !== null && calculatorState.history.trim().endsWith(operator)) {
                // Caso especial: segundo operando foi apagado para '0', histórico é "X op", usuário aperta backspace de novo
                calculatorState.displayValue = String(firstOperand).replace('.', ',');
                calculatorState.history = formatOperandForHistory(firstOperand);
                calculatorState.operator = null;
            }

            if (calculatorState.displayValue === '0' && !calculatorState.operator && calculatorState.firstOperand === null) {
                calculatorState.history = ''; // Limpa histórico se tudo estiver zerado
            }
        }


        const backspaceButton = stdButtons.querySelector('[data-action="backspace"]');
        let backspaceInterval;
        let soundInterval;

        if (backspaceButton) {
            const startBackspace = () => {
                if (calculatorState.displayValue === 'Erro') return;
                backspace(); updateStdDisplay(); playKeyClickSound('clear');
                clearInterval(backspaceInterval); clearInterval(soundInterval);
                backspaceInterval = setInterval(() => { if (calculatorState.displayValue === 'Erro') {stopBackspace(); return;} backspace(); updateStdDisplay(); }, 150);
                soundInterval = setInterval(() => { playKeyClickSound('clear'); }, 180);
            };
            const stopBackspace = () => { clearInterval(backspaceInterval); clearInterval(soundInterval); };
            backspaceButton.addEventListener('mousedown', startBackspace);
            backspaceButton.addEventListener('touchstart', (e) => { e.preventDefault(); startBackspace(); }, { passive: false });
            backspaceButton.addEventListener('mouseup', stopBackspace);
            backspaceButton.addEventListener('mouseleave', stopBackspace);
            backspaceButton.addEventListener('touchend', stopBackspace);
            backspaceButton.addEventListener('touchcancel', stopBackspace);
        }

        stdButtons.addEventListener('click', (e) => {
            const { target } = e;
            const button = target.closest('button');
            if (!button) return;
            const { action, value } = button.dataset;
            let soundType = 'number';

            if (calculatorState.displayValue === 'Erro' && action !== 'all-clear') return;

            if(action !== 'backspace') { // Som do backspace é tratado no mousedown/touchstart
                switch (action) {
                    case 'number': case 'decimal': soundType = 'number'; break;
                    case 'operator': soundType = 'operator'; break;
                    case 'calculate': soundType = 'action'; break;
                    case 'all-clear': case 'clear-entry': soundType = 'clear'; break;
                }
                 playKeyClickSound(soundType);
            }

            switch (action) {
                case 'number': inputDigit(value); break;
                case 'decimal': inputDecimal('.'); break;
                case 'operator': handleOperator(value); break;
                case 'calculate':
                    if (calculatorState.operator && calculatorState.firstOperand !== null && !calculatorState.waitingForSecondOperand) {
                        const inputValue = parseFloat(calculatorState.displayValue.replace(',', '.'));
                        if (isNaN(inputValue)) return;
                        const firstOpFormatted = formatOperandForHistory(calculatorState.firstOperand);
                        const currentOpFormatted = calculatorState.displayValue.replace('.', ',');
                        const result = performCalculation[calculatorState.operator](calculatorState.firstOperand, inputValue);
                        if (result === 'Error') {
                            calculatorState.displayValue = 'Erro';
                            calculatorState.history = `${firstOpFormatted} ${calculatorState.operator} ${currentOpFormatted} =`;
                            // Mantém firstOperand e operator para possível correção com AC
                        } else {
                            calculatorState.history = `${firstOpFormatted} ${calculatorState.operator} ${currentOpFormatted} =`;
                            const resultNum = parseFloat(result.toFixed(7));
                            calculatorState.displayValue = String(resultNum).replace('.', ',');
                            calculatorState.firstOperand = resultNum;
                            calculatorState.operator = null;
                            calculatorState.waitingForSecondOperand = true; // Pronto para novo operador ou número
                        }
                    }
                    break;
                case 'all-clear': resetCalculator(); break;
                case 'clear-entry': clearEntry(); break;
                case 'backspace': if (!backspaceInterval) backspace(); break;
            }
            updateStdDisplay();
        });
        resetCalculator();

        const baseValueIncreaseInput = document.getElementById('baseValueIncrease');
        const percentageIncreaseInput = document.getElementById('percentageIncrease');
        const calculateIncreaseBtn = document.getElementById('calculateIncreaseBtn');
        const increaseResultsArea = getResultsArea('increase');
        const displayIncreaseAmount = document.getElementById('displayIncreaseAmount');
        const displayTotalWithIncrease = document.getElementById('displayTotalWithIncrease');
        const increaseErrorDiv = getErrorDiv('increase');

        if(calculateIncreaseBtn) calculateIncreaseBtn.addEventListener('click', () => {
            clearError(increaseErrorDiv);
            const baseValue = parseFloat(sanitizeNumericInput(baseValueIncreaseInput.value));
            const percentage = parseFloat(sanitizeNumericInput(percentageIncreaseInput.value));
            if (isNaN(baseValue) || baseValue < 0) {
                showError(increaseErrorDiv, 'Insira um valor base válido.', baseValueIncreaseInput);
                increaseResultsArea.classList.remove('visible'); return;
            }
            if (isNaN(percentage) || percentage < 0) {
                showError(increaseErrorDiv, 'Insira um percentual de aumento válido.', percentageIncreaseInput);
                increaseResultsArea.classList.remove('visible'); return;
            }
            const increaseAmount = (baseValue * percentage) / 100;
            const totalWithIncrease = baseValue + increaseAmount;
            displayIncreaseAmount.textContent = formatCurrency(increaseAmount);
            displayTotalWithIncrease.textContent = formatCurrency(totalWithIncrease);
            increaseResultsArea.classList.add('visible');
        });

        const paidPriceInput = document.getElementById('paidPrice');
        const discountAppliedInput = document.getElementById('discountApplied');
        const calculateOriginalPriceBtn = document.getElementById('calculateOriginalPriceBtn');
        const originalPriceResultsArea = getResultsArea('originalPrice');
        const displayCalculatedOriginalPrice = document.getElementById('displayCalculatedOriginalPrice');
        const reversePriceErrorDiv = getErrorDiv('reversePrice');

        if(calculateOriginalPriceBtn) calculateOriginalPriceBtn.addEventListener('click', () => {
            clearError(reversePriceErrorDiv);
            const paidPrice = parseFloat(sanitizeNumericInput(paidPriceInput.value));
            const discount = parseFloat(sanitizeNumericInput(discountAppliedInput.value));
             if (isNaN(paidPrice) || paidPrice <= 0) {
                showError(reversePriceErrorDiv, 'Insira um preço pago válido.', paidPriceInput);
                originalPriceResultsArea.classList.remove('visible'); return;
            }
            if (isNaN(discount) || discount < 0 || discount >= 100) {
                showError(reversePriceErrorDiv, 'Insira um desconto válido (0 a 99.9).', discountAppliedInput);
                originalPriceResultsArea.classList.remove('visible'); return;
            }
            const originalPriceCalc = paidPrice / (1 - (discount / 100));
            displayCalculatedOriginalPrice.textContent = formatCurrency(originalPriceCalc);
            originalPriceResultsArea.classList.add('visible');
        });

        const actualOriginalPriceInput = document.getElementById('actualOriginalPrice');
        const pricePaidWithUnknownDiscountInput = document.getElementById('pricePaidWithUnknownDiscount');
        const calculateFindPercentageBtn = document.getElementById('calculateFindPercentageBtn');
        const findPercentageResultsArea = getResultsArea('findPercentage');
        const displayFoundSavedAmount = document.getElementById('displayFoundSavedAmount');
        const displayCalculatedDiscountPercentage = document.getElementById('displayCalculatedDiscountPercentage');
        const findPercentageErrorDiv = getErrorDiv('findPercentage');

        if(calculateFindPercentageBtn) calculateFindPercentageBtn.addEventListener('click', () => {
            clearError(findPercentageErrorDiv);
            const original = parseFloat(sanitizeNumericInput(actualOriginalPriceInput.value));
            const paid = parseFloat(sanitizeNumericInput(pricePaidWithUnknownDiscountInput.value));
            if (isNaN(original) || original <= 0) {
                showError(findPercentageErrorDiv, 'Insira um preço original válido.', actualOriginalPriceInput);
                findPercentageResultsArea.classList.remove('visible'); return;
            }
             if (isNaN(paid) || paid < 0) {
                showError(findPercentageErrorDiv, 'Insira um preço pago válido.', pricePaidWithUnknownDiscountInput);
                findPercentageResultsArea.classList.remove('visible'); return;
            }
            if (paid > original) {
                showError(findPercentageErrorDiv, 'O preço pago não pode ser maior que o original para calcular desconto.', pricePaidWithUnknownDiscountInput);
                findPercentageResultsArea.classList.remove('visible'); return;
            }
            const saved = original - paid;
            const percentageDisc = (saved / original) * 100;
            displayFoundSavedAmount.textContent = formatCurrency(saved);
            displayCalculatedDiscountPercentage.textContent = formatPercentage(percentageDisc);
            findPercentageResultsArea.classList.add('visible');
        });

        document.querySelectorAll('.tab-content .calc-button:not(.standard-calculator-buttons button)').forEach(button => {
            if (!button.id || (button.id && !button.id.includes('std'))) {
                 button.addEventListener('click', () => {
                    if (button.classList.contains('secondary')) {
                        playKeyClickSound('clear');
                    } else {
                        playKeyClickSound('action');
                    }
                });
            }
        });

        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('input', function (e) {
                let value = e.target.value;
                value = value.replace(/[^0-9.,]/g, '');
                const firstSeparator = value.search(/[.,]/);
                if (firstSeparator !== -1) {
                    value = value.substring(0, firstSeparator + 1) + value.substring(firstSeparator + 1).replace(/[.,]/g, '');
                }
                e.target.value = value;
            });
        });
    });