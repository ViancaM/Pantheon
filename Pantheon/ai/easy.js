class EasyAI {
    constructor(gameState) {
        this.gameState = gameState;
        this.playerId = 2; 
        this.player = gameState.players[2]; 
        this.opponent = gameState.players[1];
        this.lastTradeAttempt = null;
        this.lastTradeCardId = null;
        this.tradeAttemptCount = 0;
        this.difficultyScores = {
            'Capricorn': 3,
            'Taurus': 2,
            'Virgo': 4,
            'Aries': 3,
            'Gemini': 5,
            'Sagittarius': 3,
            'Libra': 3,
            'Aquarius': 3,
            'Pisces': 2,
            'Scorpio': 1,
            'Cancer': 3,
            'Leo': 4
        };
    }
    
    makeDecision() {
        this.player = this.gameState.players[2];
        this.opponent = this.gameState.players[1];
        
        if (this.player.geminiActive && this.player.geminiCopyMove) {
            return this.handleGeminiForcedAction();
        }
        
        if (this.shouldUseRetrograde()) {
            return this.useRetrograde();
        }
        
        if (this.lastTradeAttempt && this.lastTradeCardId) {
            const timeSinceLastAttempt = Date.now() - this.lastTradeAttempt;
            if (timeSinceLastAttempt < 3000 || this.tradeAttemptCount > 2) {
                this.lastTradeAttempt = null;
                this.tradeAttemptCount = 0;
                return this.decideChallenge() || this.decideForsake() || { action: 'skip', details: null };
            }
        }
        
        const challengeDecision = this.decideChallenge();
        if (challengeDecision) {
            return challengeDecision;
        }
        
        if (this.player.activeCards.length >= 3) {
            const tradeDecision = this.decideTrade();
            if (tradeDecision) {
                this.lastTradeAttempt = Date.now();
                this.lastTradeCardId = tradeDecision.details.cardId;
                this.tradeAttemptCount++;
                return tradeDecision;
            }
        }
        
        const forsakeDecision = this.decideForsake();
        if (forsakeDecision) {
            return forsakeDecision;
        }
        
        if (this.player.activeCards.length < 3) {
            return { action: 'draw', details: null };
        }
        
        return { action: 'skip', details: null };
    }

    handleGeminiForcedAction() {
        const copyMove = this.player.geminiCopyMove;
        if (!copyMove) {
            return { action: 'skip', details: null };
        }
        
        switch(copyMove.action) {
            case 'challenge':
                return this.handleGeminiChallengeCopy();
            case 'forsake':
                return this.handleGeminiForsakeCopy();
            case 'trade':
                return this.handleGeminiTradeCopy();
            case 'skip':
                return { action: 'skip', details: null };
            case 'retrograde':
                return this.handleGeminiRetrogradeCopy();
            case 'draw':
                return { action: 'draw', details: null };
            default:
                return { action: 'skip', details: null };
        }
    }

    handleGeminiChallengeCopy() {
        const challengeableCards = this.player.activeCards.filter(card => 
            card.element !== 'retrograde' && 
            card.challenge &&
            !this.player.completedCards.some(completed => completed.name === card.name)
        );
        
        if (challengeableCards.length > 0) {
            const easiestCard = challengeableCards.sort((a, b) => {
                return this.difficultyScores[a.name] - this.difficultyScores[b.name];
            })[0];
            return {
                action: 'challenge',
                details: { cardId: easiestCard.id }
            };
        }
        
        return { action: 'skip', details: null };
    }

    handleGeminiForsakeCopy() {
        if (this.player.activeCards.length === 0) {
            return { action: 'skip', details: null };
        }
        
        const worstCard = this.findWorstCard(this.player.activeCards);
        if (worstCard && worstCard.element !== 'retrograde') {
            return {
                action: 'forsake',
                details: { cardId: worstCard.id }
            };
        }
        
        return { action: 'skip', details: null };
    }

    handleGeminiTradeCopy() {
        if (this.player.activeCards.length === 0 || this.player.taurusActive) {
            return { action: 'skip', details: null };
        }
        
        const worstCard = this.findWorstCard(this.player.activeCards);
        if (worstCard && worstCard.element !== 'retrograde') {
            return {
                action: 'trade',
                details: { cardId: worstCard.id }
            };
        }
        
        return { action: 'skip', details: null };
    }

    handleGeminiRetrogradeCopy() {
        if (this.player.usedRetrograde || this.player.taurusActive) {
            return { action: 'skip', details: null };
        }
        
        const hasRetrograde = this.player.activeCards.some(card => card.element === 'retrograde');
        if (hasRetrograde) {
            return {
                action: 'retrograde',
                details: { cardId: this.player.activeCards.find(c => c.element === 'retrograde').id }
            };
        }
        
        return { action: 'skip', details: null };
    }

    shouldUseRetrograde() {
        if (this.player.usedRetrograde) return false;
        
        const hasRetrograde = this.player.activeCards.some(card => card.element === 'retrograde');
        if (!hasRetrograde) return false;
        
        const opponentElements = this.countElements(this.opponent.completedCards);
        const opponentCloseToWin = Object.values(opponentElements).some(count => count >= 2);
        
        const playerElements = this.countElements(this.player.completedCards);
        const playerCloseToWin = Object.values(playerElements).some(count => count >= 2);
        
        return opponentCloseToWin && !playerCloseToWin;
    }

    useRetrograde() {
        const retrogradeCard = this.player.activeCards.find(card => card.element === 'retrograde');
        return {
            action: 'retrograde',
            details: { cardId: retrogradeCard ? retrogradeCard.id : null }
        };
    }

    decideChallenge() {
        const completableCards = this.player.activeCards.filter(card => 
            card.element !== 'retrograde' && 
            card.challenge &&
            !this.player.completedCards.some(completed => completed.name === card.name)
        );
        
        if (completableCards.length === 0) return null;
        
        const sortedCards = completableCards.sort((a, b) => {
            return this.difficultyScores[a.name] - this.difficultyScores[b.name];
        });
        
        const aquariusCard = sortedCards.find(card => card.name === 'Aquarius');
        const capricornCard = sortedCards.find(card => card.name === 'Capricorn');
        
        if (aquariusCard || capricornCard) {
            const cardToAttempt = aquariusCard || capricornCard;
            return {
                action: 'challenge',
                details: { cardId: cardToAttempt.id }
            };
        }
        
        const geminiCard = sortedCards.find(card => card.name === 'Gemini');
        if (geminiCard) {
            if (!this.opponent.lastAction || this.opponent.lastAction === 'skip') {
                const otherCards = sortedCards.filter(card => card.name !== 'Gemini');
                if (otherCards.length > 0) {
                    return {
                        action: 'challenge',
                        details: { cardId: otherCards[0].id }
                    };
                }
            } else {
                return {
                    action: 'challenge',
                    details: { cardId: geminiCard.id }
                };
            }
        }
        
        const easiestCard = sortedCards[0];
        if (easiestCard) {
            return {
                action: 'challenge',
                details: { cardId: easiestCard.id }
            };
        }
        
        return null;
    }

    decideTrade() {
        if (this.player.taurusActive) return null; 
        
        if (this.lastTradeAttempt) {
            const timeSinceLast = Date.now() - this.lastTradeAttempt;
            if (timeSinceLast < 3000) {
                return null;
            }
        }
        
        const completedElements = this.countElements(this.player.completedCards);
        const unwantedCards = this.player.activeCards.filter(card => {
            if (card.element === 'retrograde') return false; 
            return !completedElements[card.element]; 
        });
        
        if (unwantedCards.length === 0) return null;
        
        const worstCard = this.findWorstCard(unwantedCards);
        return {
            action: 'trade',
            details: { cardId: worstCard.id }
        };
    }

    decideForsake() {
        const completedElements = this.countElements(this.player.completedCards);
        
        const undesirableCards = this.player.activeCards.filter(card => {
            if (card.element === 'retrograde') return false;
            
            if (card.name === "Libra" && !completedElements[card.element]) {
                return true;
            }
            
            return !completedElements[card.element];
        });
        
        if (undesirableCards.length > 0) {
            const worstCard = this.findWorstCard(undesirableCards);
            if (worstCard) {
                return {
                    action: 'forsake',
                    details: { cardId: worstCard.id }
                };
            }
        }
        
        return null;
    }

    countElements(cards) {
        const counts = {};
        cards.forEach(card => {
            if (card.element && card.element !== 'retrograde') {
                counts[card.element] = (counts[card.element] || 0) + 1;
            }
        });
        return counts;
    }

    findWorstCard(cards) {
        if (cards.length === 0) return null;
        
        const completedElements = this.countElements(this.player.completedCards);
        
        return cards.reduce((worst, current) => {
            if (!worst) return current;
            
            const worstScore = this.scoreCardForRemoval(worst, completedElements);
            const currentScore = this.scoreCardForRemoval(current, completedElements);
            
            return currentScore < worstScore ? current : worst;
        });
    }
    
    scoreCardForRemoval(card, completedElements) {
        let score = 0;
        
        if (completedElements[card.element]) {
            score -= completedElements[card.element] * 2;
        } else {
            score += 3;
        }
        
        score += this.difficultyScores[card.name] || 3;
        
        const isModal = ['Leo', 'Virgo', 'Capricorn', 'Aquarius', 'Aries'].includes(card.name);
        if (isModal) {
            score += 1; 
        }
        
        return score;
    }    

    isCloseToWinning() {
        const playerElements = this.countElements(this.player.completedCards);
        return Object.values(playerElements).some(count => count >= 2);
    }

    getMainStrategyElement() {
        const completedElements = this.countElements(this.player.completedCards);
        let mainElement = null;
        let maxCount = 0;
        
        for (const [element, count] of Object.entries(completedElements)) {
            if (count > maxCount) {
                maxCount = count;
                mainElement = element;
            }
        }
        
        if (!mainElement) {
            const activeElements = this.countElements(this.player.activeCards);
            for (const [element, count] of Object.entries(activeElements)) {
                if (count > maxCount) {
                    maxCount = count;
                    mainElement = element;
                }
            }
        }
        
        return mainElement;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EasyAI;
}