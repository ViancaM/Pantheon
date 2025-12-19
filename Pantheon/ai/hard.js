class HardAI {
    constructor(gameState) {
        this.gameState = gameState;
        this.playerId = 2;
        this.fallback = new MediumAI(gameState);
    }

    makeDecision() {
        const gs = this.gameState;
        const me = gs.players[this.playerId];

        if (me.geminiActive && me.geminiCopyMove?.action) {
            return { action: me.geminiCopyMove.action, details: null };
        }

        if (!window.PANTHEON_LLM_ENDPOINT || !window.PANTHEON_LLM_MODEL) {
            return this.fallback.makeDecision();
        }

        return this.queryLLM(gs);
    }

    queryLLM(gs) {
        const payload = this.encodeState(gs);
        const prompt = this.buildPrompt(payload);
        const endpoint = window.PANTHEON_LLM_ENDPOINT;
        const model = window.PANTHEON_LLM_MODEL || 'llama3.1:8b';

        try {
            const body = JSON.stringify({
                model,
                prompt,
                stream: false
            });

            if (typeof fetch === 'function') {
                return this.fetchDecision(endpoint, body);
            } else {
                return this.xhrDecision(endpoint, body);
            }
        } catch (err) {
            console.warn('HardAI LLM error:', err);
            return this.fallback.makeDecision();
        }
    }

    encodeState(gs) {
        const me = gs.players[this.playerId];
        const opp = gs.players[this.playerId === 1 ? 2 : 1];

        return {
            currentPlayer: gs.currentPlayer,
            yourHand: me.activeCards.map(c => ({
                id: c.id,
                name: c.name,
                element: c.element
            })),
            opponentLastAction: opp.lastAction,
            legalActions: this.getLegalActions(gs),
            actionOptions: this.getActionOptions(gs)
        };
    }

    getLegalActions(gs) {
        const p = gs.players[this.playerId];
        const actions = [];

        if (p.geminiActive && p.geminiCopyMove?.action) {
            return [p.geminiCopyMove.action];
        }

        if (p.activeCards.some(c => c.challenge)) actions.push("challenge");
        if (p.activeCards.some(c => c.element !== "retrograde")) actions.push("forsake");
        if (!p.taurusActive) actions.push("trade");
        if (!p.usedRetrograde) actions.push("retrograde");

        actions.push("draw", "skip");
        return actions;
    }

    getActionOptions(gs) {
        const p = gs.players[this.playerId];
        const opp = gs.players[this.playerId === 1 ? 2 : 1];

        const challengeable = (p.activeCards || []).filter(card => card.element !== "retrograde" && card.challenge)
            .map(card => ({ id: card.id, name: card.name }));
        const forsakeable = (p.activeCards || []).filter(card => card.element !== "retrograde")
            .map(card => ({ id: card.id, name: card.name }));
        const tradable = (!p.taurusActive && (opp?.activeCards?.length || 0)) ? forsakeable : [];
        const retro = (p.activeCards || []).filter(card => card.element === "retrograde")
            .map(card => ({ id: card.id, name: card.name }));

        return {
            challenge: challengeable,
            forsake: forsakeable,
            trade: tradable,
            retrograde: retro
        };
    }

    buildPrompt(payload) {
        return `
You are the Hard difficulty AI for the Pantheon card game. You are Player ${this.playerId}.
Game state JSON:
${JSON.stringify(payload, null, 2)}

Goal: Return the single best move as JSON with structure:
{"action":"<one of ${payload.legalActions.join(', ')}>", "details":{"cardId":<number>}}

Rules:
- Only choose from the provided legalActions.
- If the action uses a card (challenge, forsake, trade, retrograde), pick a cardId listed under actionOptions for that action.
- If no card is needed (draw, skip), set details to null.
- Respond with JSON only, no extra text.
`;
    }

    fetchDecision(endpoint, body) {
        const headers = { 'Content-Type': 'application/json' };
        if (window.PANTHEON_LLM_API_KEY) {
            headers['Authorization'] = `Bearer ${window.PANTHEON_LLM_API_KEY}`;
        }

        let responseText = null;

        const xhr = new XMLHttpRequest();
        xhr.open('POST', endpoint, false);
        Object.entries(headers).forEach(([key, val]) => xhr.setRequestHeader(key, val));

        xhr.send(body);
        if (xhr.status < 200 || xhr.status >= 300) {
            return this.fallback.makeDecision();
        }
        responseText = xhr.responseText;
        return this.parseLLMResponse(responseText) || this.fallback.makeDecision();
    }

    xhrDecision(endpoint, body) {
        return this.fetchDecision(endpoint, body);
    }

    parseLLMResponse(raw) {
        try {
            const parsed = JSON.parse(raw);
            const reply = parsed.response || '';
            const jsonMatch = reply.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;
            const decision = JSON.parse(jsonMatch[0]);
            if (!decision || !decision.action) return null;
            if (!decision.details) decision.details = null;
            return decision;
        } catch (err) {
            console.warn('Failed to parse LLM response:', err);
            return null;
        }
    }
}

window.HardAI = HardAI;
