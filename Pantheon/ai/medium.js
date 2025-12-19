class MediumAI {
    constructor(gameState) {
        this.gameState = gameState;
        this.playerId = 2;
        this.iterations = 600;
        this.rolloutDepth = 6;
        this.challengeSuccess = {
            Capricorn: 0.7,
            Taurus: 0.8,
            Virgo: 0.65,
            Aries: 0.55,
            Gemini: 0.35,
            Sagittarius: 0.6,
            Libra: 0.8,
            Aquarius: 0.6,
            Pisces: 0.9,
            Scorpio: 0.5,
            Cancer: 0.75,
            Leo: 0.55
        };
    }

    makeDecision() {
        const gs = this.gameState;
        const me = gs.players[this.playerId];

        if (me.geminiActive && me.geminiCopyMove?.action) {
            return { action: me.geminiCopyMove.action, details: me.geminiCopyMove.details || null };
        }

        const rootState = this.cloneState(gs);
        rootState.currentPlayer = this.playerId;
        const root = this.createNode(rootState, null, null);

        for (let i = 0; i < this.iterations; i++) {
            let node = root;

            while (node.children.length && node.untriedMoves.length === 0) {
                node = this.selectUCT(node);
            }

            if (node.untriedMoves.length) {
                node = this.expand(node);
            }

            const value = this.rollout(this.cloneState(node.state));
            this.backpropagate(node, value);
        }

        const best = this.bestChild(root);
        const fallback = this.getHeuristicMove(gs);

        let decision = best?.move;
        if (!decision) decision = fallback;
        if (!decision) decision = { action: "skip", details: null };

        const normalized = this.normalizeDecision(decision, gs);
        if (normalized.action === "skip" && fallback && fallback.action !== "skip") {
            return this.normalizeDecision(fallback, gs);
        }
        return normalized;
    }

    cloneState(state) {
        return JSON.parse(JSON.stringify(state));
    }

    createNode(state, move, parent) {
        return {
            state,
            move,
            parent,
            children: [],
            untriedMoves: this.getLegalMoves(state),
            visits: 0,
            value: 0
        };
    }

    selectUCT(node) {
        let bestChild = null;
        let bestVal = -Infinity;

        for (let i = 0; i < node.children.length; i++) {
            const c = node.children[i];
            const uct = c.visits === 0
                ? 1e18
                : (c.value / c.visits) + Math.sqrt(2 * Math.log(node.visits + 1) / c.visits);

            if (uct > bestVal) {
                bestVal = uct;
                bestChild = c;
            }
        }

        return bestChild || node;
    }

    expand(node) {
        const move = node.untriedMoves.pop();
        const nextState = this.cloneState(node.state);
        this.applyMove(nextState, move);
        const child = this.createNode(nextState, move, node);
        node.children.push(child);
        return child;
    }

    rollout(state) {
        let depth = 0;

        while (depth < this.rolloutDepth) {
            const moves = this.getLegalMoves(state);
            if (!moves.length) break;

            let move;
            if (state.currentPlayer === this.playerId) {
                const nonSkip = moves.filter(m => m.action !== "skip");
                move = nonSkip.length ? nonSkip[Math.floor(Math.random() * nonSkip.length)] : moves[0];
            } else {
                move = moves[Math.floor(Math.random() * moves.length)];
            }

            this.applyMove(state, move);
            depth++;
        }

        return this.evaluateState(state);
    }

    backpropagate(node, value) {
        let n = node;
        while (n) {
            n.visits++;
            n.value += value;
            n = n.parent;
        }
    }

    bestChild(node) {
        if (!node.children.length) return null;

        let best = node.children[0];
        let bestVisits = best.visits;

        for (let i = 1; i < node.children.length; i++) {
            const c = node.children[i];
            if (c.visits > bestVisits) {
                best = c;
                bestVisits = c.visits;
            }
        }

        return best;
    }

    getLegalMoves(state) {
        const player = state.players[state.currentPlayer];
        if (!player) return [];

        if (player.geminiActive && player.geminiCopyMove?.action) {
            return [{ action: player.geminiCopyMove.action, details: player.geminiCopyMove.details || null }];
        }

        const moves = [];
        const oppId = state.currentPlayer === 1 ? 2 : 1;
        const opp = state.players[oppId];

        if (player.activeCards?.length) {
            for (let i = 0; i < player.activeCards.length; i++) {
                const card = player.activeCards[i];
                if (card.element !== "retrograde" && card.challenge) {
                    moves.push({ action: "challenge", details: { cardId: card.id } });
                }
                if (card.element !== "retrograde") {
                    moves.push({ action: "forsake", details: { cardId: card.id } });
                }
            }
        }

        if (!player.taurusActive && player.activeCards?.length && opp?.activeCards?.length) {
            const c = player.activeCards.find(x => x.element !== "retrograde");
            if (c) moves.push({ action: "trade", details: { cardId: c.id } });
        }

        if (!player.usedRetrograde && player.activeCards?.some(c => c.element === "retrograde")) {
            const r = player.activeCards.find(c => c.element === "retrograde");
            moves.push({ action: "retrograde", details: { cardId: r?.id || null } });
        }

        if ((player.activeCards?.length || 0) < 3 || (state.deck?.length || 0) > 0) {
            moves.push({ action: "draw", details: null });
        }

        if (!moves.length) {
            moves.push({ action: "skip", details: null });
        }

        return moves;
    }

    applyMove(state, move) {
        const player = state.players[state.currentPlayer];
        const oppId = state.currentPlayer === 1 ? 2 : 1;
        const opp = state.players[oppId];

        const draw = () => {
            state.deck = state.deck || [];
            state.discardPile = state.discardPile || [];
            if (!state.deck.length && state.discardPile.length) {
                this.shuffle(state.discardPile);
                state.deck = state.discardPile.splice(0);
            }
            return state.deck.pop() || null;
        };

        const remove = (arr, id) => {
            if (!arr) return null;
            const i = arr.findIndex(c => c.id === id);
            return i >= 0 ? arr.splice(i, 1)[0] : null;
        };

        player.lastAction = move.action;

        if (move.action === "challenge") {
            const card = remove(player.activeCards, move.details?.cardId);
            if (card) {
                if (Math.random() < (this.challengeSuccess[card.name] || 0.5)) {
                    player.completedCards.push(card);
                } else {
                    state.discardPile.push(card);
                }
            }
        } else if (move.action === "forsake") {
            const card = remove(player.activeCards, move.details?.cardId);
            if (card) {
                state.discardPile.push(card);
                const d = draw();
                if (d) player.activeCards.push(d);
            }
        } else if (move.action === "trade" && !player.taurusActive && opp?.activeCards?.length) {
            const give = remove(player.activeCards, move.details?.cardId);
            if (give) {
                const take = opp.activeCards[Math.floor(Math.random() * opp.activeCards.length)];
                remove(opp.activeCards, take.id);
                opp.activeCards.push(give);
                player.activeCards.push(take);
            }
        } else if (move.action === "retrograde" && !player.usedRetrograde) {
            player.usedRetrograde = true;
            state.deck.push(...player.completedCards.splice(0), ...opp.completedCards.splice(0));
            this.shuffle(state.deck);
        } else if (move.action === "draw") {
            const d = draw();
            if (d) player.activeCards.push(d);
        }

        state.currentPlayer = oppId;
    }

    evaluateState(state) {
        const me = state.players[this.playerId];
        const opp = state.players[this.playerId === 1 ? 2 : 1];

        const myCounts = this.countElements(me.completedCards);
        const oppCounts = this.countElements(opp.completedCards);

        const myMax = Math.max(0, ...Object.values(myCounts));
        const oppMax = Math.max(0, ...Object.values(oppCounts));

        return (
            me.completedCards.length * 12 -
            opp.completedCards.length * 14 +
            myMax * 6 -
            oppMax * 6 +
            (me.activeCards.length - opp.activeCards.length)
        );
    }

    countElements(cards) {
        const m = {};
        (cards || []).forEach(c => {
            if (c?.element && c.element !== "retrograde") {
                m[c.element] = (m[c.element] || 0) + 1;
            }
        });
        return m;
    }

    shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
    }

    getHeuristicMove(state) {
        const player = state.players[this.playerId];
        const oppId = this.playerId === 1 ? 2 : 1;
        const opponent = state.players[oppId];
        if (!player) return null;

        const challengeable = (player.activeCards || []).filter(
            card => card.element !== "retrograde" && card.challenge &&
                !(player.completedCards || []).some(c => c.name === card.name)
        );
        if (challengeable.length) {
            return { action: "challenge", details: { cardId: challengeable[0].id } };
        }

        const forsakeable = (player.activeCards || []).find(card => card.element !== "retrograde");
        if (forsakeable) {
            return { action: "forsake", details: { cardId: forsakeable.id } };
        }

        if ((player.activeCards?.length || 0) < 3 && (state.deck?.length || 0) > 0) {
            return { action: "draw", details: null };
        }

        if (!player.taurusActive && forsakeable && (opponent?.activeCards?.length || 0)) {
            return { action: "trade", details: { cardId: forsakeable.id } };
        }

        if (!player.usedRetrograde && (player.activeCards || []).some(c => c.element === "retrograde")) {
            const retro = player.activeCards.find(c => c.element === "retrograde");
            return { action: "retrograde", details: { cardId: retro?.id || null } };
        }

        if ((state.deck?.length || 0) > 0) {
            return { action: "draw", details: null };
        }

        return { action: "skip", details: null };
    }

    normalizeDecision(move, state) {
        const player = state.players[this.playerId];
        const opponent = state.players[this.playerId === 1 ? 2 : 1];
        if (!player || !move) return { action: "skip", details: null };

        const normalized = {
            action: move.action,
            details: move.details ? { ...move.details } : null
        };

        const ensureCard = (predicate) => {
            const card = (player.activeCards || []).find(predicate);
            return card ? card.id : null;
        };

        switch (normalized.action) {
            case "challenge": {
                const id = normalized.details?.cardId;
                if (!id || !(player.activeCards || []).some(c => c.id === id)) {
                    const replacement = (player.activeCards || []).find(
                        card => card.element !== "retrograde" && card.challenge &&
                            !(player.completedCards || []).some(c => c.name === card.name)
                    );
                    if (!replacement) return { action: "skip", details: null };
                    normalized.details = { cardId: replacement.id };
                }
                break;
            }
            case "forsake": {
                const id = normalized.details?.cardId;
                if (!id || !(player.activeCards || []).some(c => c.id === id && c.element !== "retrograde")) {
                    const replacement = (player.activeCards || []).find(c => c.element !== "retrograde");
                    if (!replacement) return { action: "skip", details: null };
                    normalized.details = { cardId: replacement.id };
                }
                break;
            }
            case "trade": {
                if (player.taurusActive) return { action: "skip", details: null };
                const id = normalized.details?.cardId;
                if (!id || !(player.activeCards || []).some(c => c.id === id && c.element !== "retrograde")) {
                    const replacement = (player.activeCards || []).find(c => c.element !== "retrograde");
                    if (!replacement) return { action: "skip", details: null };
                    normalized.details = { cardId: replacement.id };
                }
                if (!(opponent?.activeCards || []).length) {
                    return { action: "skip", details: null };
                }
                break;
            }
            case "retrograde": {
                if (player.usedRetrograde || player.taurusActive) {
                    return { action: "skip", details: null };
                }
                const retro = (player.activeCards || []).find(c => c.element === "retrograde");
                if (!retro) return { action: "skip", details: null };
                normalized.details = { cardId: retro.id };
                break;
            }
            case "draw":
                if ((player.activeCards?.length || 0) >= 3 && !(state.deck?.length || 0)) {
                    return { action: "skip", details: null };
                }
                normalized.details = null;
                break;
            default:
                normalized.details = null;
                break;
        }

        return normalized;
    }
}

window.MediumAI = MediumAI;
