import { CURRENCIES } from "@/data/currency";
import { logger } from "@/src/services/logger";
import { useRouteLoaderData } from "react-router";

export default function CurrencySymbol({ currency, className }) {
    const session = useRouteLoaderData('root');
    const currencyCode = currency
        ? currency
        : session?.account?.currency || 'usd';
    const currencyObj = CURRENCIES.find(c => c.code.toLowerCase() === currencyCode.toLowerCase());
    const symbol = currencyObj?.symbol || '';
    // const currencyObj = getCurrencyDisplayName(session?.currency || 'amd');

    // logger.info("session: ", session)


    return (
        <span className={className}>{symbol}</span>
    );
}