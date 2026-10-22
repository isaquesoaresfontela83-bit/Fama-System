export const lookupProviders = [
    { id: 'brasilapi', label: 'BrasilAPI', types: ['cep', 'cnpj'] },
    { id: 'receitaws', label: 'ReceitaWS', types: ['cnpj'] },
];
export function taxDocumentCode(value) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ''); }
export function formatRegistrationDocument(value) {
    const code = taxDocumentCode(value).slice(0, 14);
    if (!/[A-Z]/.test(code) && code.length <= 11)
        return code.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return code.replace(/^([A-Z0-9]{2})([A-Z0-9])/, '$1.$2').replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})([A-Z0-9])/, '$1.$2.$3').replace(/\.([A-Z0-9]{3})([A-Z0-9])/, '.$1/$2').replace(/([A-Z0-9]{4})([0-9]{1,2})$/, '$1-$2');
}
export function normalizeLookupValue(type, value) {
    if (typeof value !== 'string' || value.length > 40 || (type === 'cep' ? /[^0-9\s-]/.test(value) : /[^a-zA-Z0-9\s./-]/.test(value)))
        throw new Error('Informe um ' + (type === 'cep' ? 'CEP válido com 8 dígitos.' : 'CNPJ válido com 14 caracteres.'));
    const code = type === 'cep' ? value.replace(/[\s-]/g, '') : taxDocumentCode(value);
    if (!(type === 'cep' ? /^[0-9]{8}$/ : /^[A-Z0-9]{12}[0-9]{2}$/).test(code))
        throw new Error('Informe um ' + (type === 'cep' ? 'CEP válido com 8 dígitos.' : 'CNPJ válido com 14 caracteres.'));
    return code;
}
export function normalizeCpf(value) {
    if (typeof value !== 'string' || value.length > 20 || /[^0-9.\s-]/.test(value))
        throw new Error('Informe um CPF válido.');
    const code = value.replace(/\D/g, '');
    if (!/^\d{11}$/.test(code) || /^(\d)\1{10}$/.test(code))
        throw new Error('Informe um CPF válido.');
    for (let n = 9; n <= 10; n++) {
        const sum = [...code.slice(0, n)].reduce((total, digit, index) => total + Number(digit) * (n + 1 - index), 0);
        if ((sum * 10 % 11 % 10) !== Number(code[n]))
            throw new Error('Informe um CPF válido.');
    }
    return code;
}
