/** Small arithmetic parser. No eval, code execution or access to app records. */
export function nativeCalculation(message) {
    if (!/^\s*(calcule|calcular|quanto [ée]|quanto d[áa]|fa[çc]a a conta)\b/i.test(message))
        return null;
    let expression = message.replace(/^\s*(calcule|calcular|quanto [ée]|quanto d[áa]|fa[çc]a a conta)\s*/i, '').replace(/[?=]\s*$/, '').replace(/R\$|reais/gi, '').trim();
    expression = expression.replace(/mais/gi, '+').replace(/menos/gi, '-').replace(/(?:vezes|multiplicado por)/gi, '*').replace(/dividido por/gi, '/').replace(/[×x]/g, '*').replace(/÷/g, '/');
    const fail = () => ({ source: 'overview', title: 'Confira o cálculo', engine: 'internal', text: 'Use números e operações +, −, × e ÷. Exemplo: “Calcule 450 * 1,10”. Uma porcentagem isolada equivale à fração: 10% = 0,10.', actions: [] });
    if (expression.length > 240 || /[^\d.,+*/()%\s-]/.test(expression))
        return fail();
    const tokens = expression.match(/\d+(?:[.,]\d+)*|[()+*/%-]/g) ?? [];
    if (!tokens.length || tokens.length > 80)
        return fail();
    let index = 0;
    const number = (value) => Number(value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value);
    function primary() {
        let value;
        const token = tokens[index++];
        if (token === '(') {
            value = sum();
            if (tokens[index++] !== ')')
                throw new Error();
        }
        else if (token === '+' || token === '-')
            value = (token === '-' ? -1 : 1) * primary();
        else {
            if (!token || !/^\d/.test(token))
                throw new Error();
            value = number(token);
        }
        if (tokens[index] === '%') {
            index++;
            value /= 100;
        }
        if (!Number.isFinite(value))
            throw new Error();
        return value;
    }
    function product() { let value = primary(); while (tokens[index] === '*' || tokens[index] === '/') {
        const operator = tokens[index++];
        const next = primary();
        if (operator === '/' && next === 0)
            throw new Error();
        value = operator === '*' ? value * next : value / next;
    } return value; }
    function sum() { let value = product(); while (tokens[index] === '+' || tokens[index] === '-') {
        const operator = tokens[index++];
        const next = product();
        value = operator === '+' ? value + next : value - next;
    } return value; }
    try {
        const result = sum();
        if (index !== tokens.length || !Number.isFinite(result) || Math.abs(result) > 1e12)
            return fail();
        const value = result.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
        const note = 'Cálculo dos valores informados na pergunta. Não altera registros nem inclui saldo bancário.' + (expression.includes('%') ? ' Porcentagens equivalem a frações: 10% = 0,10.' : '');
        return { source: 'overview', engine: 'internal', title: 'Cálculo conferido', text: `${expression} = ${value}\n${note}`, metrics: [{ label: 'Resultado', value }], narrative: expression, note, actions: [] };
    }
    catch {
        return fail();
    }
}
