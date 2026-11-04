import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchIcon } from "lucide-react";
import { Input } from "@/src/components/ui/inputs";
import { OutlineButton, PrimaryButton } from "@/src/components/ui/buttons";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import Image from "@/src/components/wraps/image";
import CurrencySymbol from "@/src/components/render/currency";

const DEFAULT_PART_IMAGE = '/images/other/gears.png';

const sampleResellerParts = [
    {
        id: 'reseller-54101',
        sku: '54101',
        name: 'Фильтр масляный',
        price: 12580,
        quantity: 12,
        image: 'https://imgcdn.abcp.ru/p/08013a13110cd7b15c45a65d36d2a3b0bb070d991d4973d4c07872.png',
        currency: 'amd',
        brand: 'Hyundai',
        make: { name: 'Hyundai' },
        model: { name: 'KIA' },
        provider: 'emex.ru',
    },
    {
        id: 'reseller-54102',
        sku: '54102',
        name: 'Масляный насос',
        price: 132500,
        quantity: 4,
        image: 'https://imgcdn.abcp.ru/p/162996a313ce933df6e1a8d2251a3fdc97d2c069f3be7460087005.jpeg',
        currency: 'amd',
        brand: 'Bosch',
        make: { name: 'BMW' },
        model: { name: '3 Series' },
        provider: 'emex.ru',
    },
    {
        id: 'reseller-6514681',
        sku: '65163',
        name: 'Свеча зажигания',
        price: 320,
        quantity: 4,
        image: 'https://emex.ru/static/images/main-page-best-offers/hyundai-1885510060.jpeg',
        currency: 'RUB',
        brand: 'Bosch',
        make: { name: 'BMW' },
        model: { name: '3 Series' },
        provider: 'emex.ru',
    },
];

const DEFAULT_PAGE_SIZE = 10;

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const normalizePart = (part, source = 'local') => {
    const makeName = part?.make?.name || part?.brand || 'Unknown';
    const modelName = part?.model?.name || '';
    const providerName = part?.provider || part?.vendor || part?.supplier || (source === 'reseller' ? 'external' : 'own');
    const normalized = {
        id: part?.id ?? `${source}-${Math.random().toString(36).slice(2, 10)}`,
        sku: part?.sku ?? part?.code ?? '-',
        name: part?.name ?? 'Unnamed item',
        price: toNumber(part?.price ?? part?.unitPrice ?? 0, 0),
        quantity: toNumber(part?.quantity ?? part?.stock ?? 0, 0),
        image: part?.image || part?.thumbnail || DEFAULT_PART_IMAGE,
        currency: part?.currency ?? 'USD',
        brand: part?.brand || part?.make?.name || 'Unknown',
        make: part?.make ?? { name: makeName },
        model: part?.model ?? { name: modelName },
        source,
        provider: providerName,
    };

    return normalized;
};

const mergeParts = (localParts = [], resellerParts = []) => {
    const localNormalized = localParts.map((part) => normalizePart(part, 'local'));
    const resellerNormalized = resellerParts.map((part) => normalizePart(part, 'reseller'));
    const merged = [...localNormalized, ...resellerNormalized];
    const unique = new Map();

    merged.forEach((part) => {
        const key = `${part.source}:${part.id}`;
        if (!unique.has(key)) unique.set(key, part);
    });

    return [...unique.values()].sort((a, b) => {
        if (a.source === b.source) return 0;
        return a.source === 'local' ? -1 : 1;
    });
};

const filterParts = (parts, searchQuery = '') => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return parts;

    return parts.filter((part) => {
        const haystack = [
            part?.sku,
            part?.name,
            part?.brand,
            part?.make?.name,
            part?.model?.name,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return haystack.includes(q);
    });
};

export default function PartsCatalog({
    onChange = () => { },
    pageSize = DEFAULT_PAGE_SIZE,
}) {
    const { t } = useTranslation();

    const [_parts, _setParts] = useState([]);
    const [_isLoading, _setIsLoading] = useState(false);
    const [_searchInput, _setSearchInput] = useState("");
    const [_searchQuery, _setSearchQuery] = useState("");
    const [_page, _setPage] = useState(1);
    const [_totalCount, _setTotalCount] = useState(0);

    const _limit = useMemo(() => {
        const parsed = parseInt(pageSize, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE_SIZE;
    }, [pageSize]);

    const _offset = useMemo(() => (_page - 1) * _limit, [_page, _limit]);
    const _totalPages = useMemo(() => {
        if (_totalCount <= 0) return 1;
        return Math.max(1, Math.ceil(_totalCount / _limit));
    }, [_totalCount, _limit]);

    const fetchParts = async () => {
        try {
            _setIsLoading(true);
            const response = await sendBackRequest({
                itsFor: "parts",
                action: "get",
                offset: _offset,
                limit: _limit,
                searchQuery: _searchQuery,
            });

            const localParts = Array.isArray(response?.data) ? response.data : [];
            const mergedParts = mergeParts(localParts, sampleResellerParts);
            const filteredParts = filterParts(mergedParts, _searchQuery);
            const paginatedParts = filteredParts.slice(_offset, _offset + _limit);

            if (response.success) {
                _setParts(paginatedParts);
                _setTotalCount(filteredParts.length);
            } else {
                logger.error("PartsCatalog fetch failed:", response.message);
                notify({
                    type: "error",
                    message: response.message || t("Failed to fetch parts"),
                });

                const fallbackParts = filterParts(mergeParts([], sampleResellerParts), _searchQuery);
                _setParts(fallbackParts.slice(_offset, _offset + _limit));
                _setTotalCount(fallbackParts.length);
            }
        } catch (error) {
            logger.error("PartsCatalog fetch error:", error);
            notify({
                type: "error",
                message: t("Failed to fetch parts"),
            });

            const fallbackParts = filterParts(mergeParts([], sampleResellerParts), _searchQuery);
            _setParts(fallbackParts.slice(_offset, _offset + _limit));
            _setTotalCount(fallbackParts.length);
        } finally {
            _setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            _setSearchQuery(_searchInput.trim());
        }, 350);

        return () => clearTimeout(timer);
    }, [_searchInput]);

    useEffect(() => {
        _setPage(1);
    }, [_searchQuery]);

    useEffect(() => {
        fetchParts();
    }, [_offset, _limit, _searchQuery]);

    const formatCurrency = (value) => {
        const number = toNumber(value, 0);
        return number.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const handleSelectPart = (part) => {

        onChange(part ? [part] : []);

        // const unitPrice = toNumber(part?.price, 0);

        // const orderLine = {
        //     type: "part",
        //     partId: part?.id ?? null,
        //     sku: part?.sku ?? "",
        //     name: part?.name ?? "",
        //     description: part?.description ?? "",
        //     quantity: 1,
        //     unitPrice,
        //     totalPrice: unitPrice,
        // };

        // onChange?.([orderLine]);
        // notify({
        //     type: "success",
        //     message: t("Part added to order"),
        // });
    };

    const hasData = _parts.length > 0;
    const from = _totalCount === 0 ? 0 : _offset + 1;
    const to = _totalCount === 0 ? 0 : Math.min(_offset + _parts.length, _totalCount);

    return (
        <div className="w-full flex flex-col gap-4 p-1">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h2 className="text-xl font-semibold">{t("Parts Catalog")}</h2>

                <div className="w-full md:w-80 relative">
                    <SearchIcon className="size-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                        type="text"
                        value={_searchInput}
                        onChange={(e) => _setSearchInput(e.target.value)}
                        placeholder={t("Search by SKU, name, brand...")}
                        className="pl-9"
                    />
                </div>
            </div>

            <div className="rounded-md border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left px-4 py-2 font-medium">{t("Image")}</th>
                                <th className="text-left px-4 py-2 font-medium">{t("SKU")}</th>
                                <th className="text-left px-4 py-2 font-medium">{t("Name")}</th>
                                <th className="text-left px-4 py-2 font-medium">{t("Brand")}</th>
                                <th className="text-right px-4 py-2 font-medium">{t("Price")}</th>
                                <th className="text-right px-4 py-2 font-medium">{t("Stock")}</th>
                                <th className="text-right px-4 py-2 font-medium">{t("Action")}</th>
                            </tr>
                        </thead>

                        <tbody>
                            {_isLoading && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                                        {t("Loading parts...")}
                                    </td>
                                </tr>
                            )}

                            {!_isLoading && !hasData && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                                        {t("No parts found")}
                                    </td>
                                </tr>
                            )}

                            {!_isLoading && hasData && _parts.map((part) => (
                                <tr key={`${part.source}-${part.id}`} className="border-t border-gray-100">
                                    <td className="px-4 py-2">
                                        <Image
                                            src={part?.image || DEFAULT_PART_IMAGE}
                                            alt={part?.name || 'Part image'}
                                            className="h-20 w-20 rounded-md object-cover border border-gray-200 bg-gray-50"
                                        />
                                    </td>
                                    <td className="px-4 py-2">{part?.sku || "-"}</td>
                                    <td className="px-4 py-2">
                                        <div className="flex flex-col gap-1">
                                            <span>{part?.name || "-"}</span>
                                            {part?.source === 'reseller' && (
                                                <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                                                    {part?.provider ? `External · ${part.provider}` : 'External'}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">{part?.brand || "-"}</td>
                                    <td className="px-4 py-2 text-right">
                                        <CurrencySymbol currency={part?.currency} className="inline-block w-4 h-4 mr-1" />
                                        {formatCurrency(part?.price)}
                                    </td>
                                    <td className="px-4 py-2 text-right">{toNumber(part?.quantity, 0)}</td>
                                    <td className="px-4 py-2 text-right">
                                        <PrimaryButton
                                            size="sm"
                                            onClick={() => handleSelectPart(part)}
                                        >
                                            {t("Add")}
                                        </PrimaryButton>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="text-sm text-gray-500">
                    {t("Showing")} {from}-{to} {t("of")} {_totalCount}
                </div>

                <div className="flex items-center gap-2">
                    <OutlineButton
                        size="sm"
                        onClick={() => _setPage((prev) => Math.max(1, prev - 1))}
                        disabled={_page <= 1 || _isLoading}
                    >
                        {t("Previous")}
                    </OutlineButton>

                    <div className="px-2 text-sm text-gray-700">
                        {t("Page")} {_page} / {_totalPages}
                    </div>

                    <OutlineButton
                        size="sm"
                        onClick={() => _setPage((prev) => Math.min(_totalPages, prev + 1))}
                        disabled={_page >= _totalPages || _isLoading}
                    >
                        {t("Next")}
                    </OutlineButton>
                </div>
            </div>
        </div>
    );
}