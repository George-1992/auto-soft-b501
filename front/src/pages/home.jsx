import Card from "@/src/components/ui/card";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { setMetas } from "@/src/services/metas";
import { CarFrontIcon, ClipboardListIcon, HomeIcon, UsersIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export default function Home() {
    setMetas({
        title: 'Home',
        description: 'Welcome to the home page',
    });

    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [vehicles, setVehicles] = useState([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            setError('');

            try {
                const [ordersRes, customersRes, vehiclesRes] = await Promise.all([
                    sendBackRequest({
                        itsFor: 'orders',
                        action: 'get',
                        limit: 200,
                    }),
                    sendBackRequest({
                        itsFor: 'customers',
                        action: 'get',
                        limit: 200,
                    }),
                    sendBackRequest({
                        itsFor: 'vehicles',
                        action: 'get',
                        limit: 200,
                        include: {
                            make: true,
                            model: true,
                            customer: true,
                        },
                    }),
                ]);

                setOrders(Array.isArray(ordersRes?.data) ? ordersRes.data : []);
                setCustomers(Array.isArray(customersRes?.data) ? customersRes.data : []);
                setVehicles(Array.isArray(vehiclesRes?.data) ? vehiclesRes.data : []);

                if (!ordersRes?.success || !customersRes?.success || !vehiclesRes?.success) {
                    setError(t('Some data could not be loaded.'));
                }
            } catch (fetchError) {
                logger.error('Home dashboard fetch error', fetchError);
                setError(t('Failed to load home dashboard data.'));
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [t]);

    const recentOrders = useMemo(() => {
        return [...orders]
            .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
            .slice(0, 5);
    }, [orders]);

    const recentCustomers = useMemo(() => {
        return [...customers]
            .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
            .slice(0, 5);
    }, [customers]);

    const recentVehicles = useMemo(() => {
        return [...vehicles]
            .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
            .slice(0, 5);
    }, [vehicles]);

    const formatDate = (value) => {
        if (!value) return t('N/A');
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return t('N/A');
        return parsed.toLocaleDateString();
    };

    const orderCountByStatus = useMemo(() => {
        return orders.reduce((acc, item) => {
            const key = item?.status || 'unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
    }, [orders]);

    return (
        <div className="w-full space-y-5">
            <Card>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <HomeIcon className="size-10 text-sky-600 mb-3" />
                        <h1 className="text-2xl font-bold">{t('Welcome back')}!</h1>
                        <p className="mt-2 text-gray-600">
                            {t('Quick view of orders, customers, and vehicles in your workspace.')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="px-3 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50"
                    >
                        {t('Refresh')}
                    </button>
                </div>
            </Card>

            {error && (
                <Card className="border-rose-200 bg-rose-50">
                    <p className="text-rose-700 text-sm">{error}</p>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card isLoading={isLoading}>
                    <div className="flex items-center gap-3 mb-2">
                        <ClipboardListIcon className="size-5 text-sky-600" />
                        <h2 className="font-semibold">{t('Orders')}</h2>
                    </div>
                    <p className="text-3xl font-bold">{orders.length}</p>
                    <p className="text-xs text-gray-500 mt-2">
                        {t('Open')}: {(orderCountByStatus.estimate || 0) + (orderCountByStatus.approved || 0)}
                    </p>
                </Card>

                <Card isLoading={isLoading}>
                    <div className="flex items-center gap-3 mb-2">
                        <UsersIcon className="size-5 text-emerald-600" />
                        <h2 className="font-semibold">{t('Customers')}</h2>
                    </div>
                    <p className="text-3xl font-bold">{customers.length}</p>
                    <p className="text-xs text-gray-500 mt-2">
                        {t('Recently added')} {recentCustomers.length}
                    </p>
                </Card>

                <Card isLoading={isLoading}>
                    <div className="flex items-center gap-3 mb-2">
                        <CarFrontIcon className="size-5 text-amber-600" />
                        <h2 className="font-semibold">{t('Vehicles')}</h2>
                    </div>
                    <p className="text-3xl font-bold">{vehicles.length}</p>
                    <p className="text-xs text-gray-500 mt-2">
                        {t('Tracked in this workspace')}
                    </p>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card>
                    <h3 className="font-semibold mb-3">{t('Recent Orders')}</h3>
                    {recentOrders.length === 0 && !isLoading && (
                        <p className="text-sm text-gray-500">{t('No orders yet.')}</p>
                    )}
                    <div className="space-y-2">
                        {recentOrders.map((order) => (
                            <div key={order.id} className="border border-gray-100 rounded-md p-3">
                                <div className="flex justify-between gap-3">
                                    <p className="font-medium truncate">{order.name || t('Untitled Order')}</p>
                                    <span className="text-xs px-2 py-1 rounded-full bg-sky-100 text-sky-700">
                                        {order.status || 'unknown'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    #{order.orderNumber || 'N/A'} • {formatDate(order.createdAt)}
                                </p>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card>
                    <h3 className="font-semibold mb-3">{t('Recent Customers')}</h3>
                    {recentCustomers.length === 0 && !isLoading && (
                        <p className="text-sm text-gray-500">{t('No customers yet.')}</p>
                    )}
                    <div className="space-y-2">
                        {recentCustomers.map((customer) => (
                            <div key={customer.id} className="border border-gray-100 rounded-md p-3">
                                <p className="font-medium">
                                    {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || t('Unnamed Customer')}
                                </p>
                                <p className="text-xs text-gray-500 mt-1 truncate">
                                    {customer.email || customer.phone || t('No contact info')}
                                </p>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card>
                    <h3 className="font-semibold mb-3">{t('Recent Vehicles')}</h3>
                    {recentVehicles.length === 0 && !isLoading && (
                        <p className="text-sm text-gray-500">{t('No vehicles yet.')}</p>
                    )}
                    <div className="space-y-2">
                        {recentVehicles.map((vehicle) => (
                            <div key={vehicle.id} className="border border-gray-100 rounded-md p-3">
                                <p className="font-medium">
                                    {[vehicle.year, vehicle.make?.name, vehicle.model?.name].filter(Boolean).join(' ') || t('Vehicle')}
                                </p>
                                <p className="text-xs text-gray-500 mt-1 truncate">
                                    {vehicle.licensePlate || vehicle.vin || t('No plate or VIN')}
                                </p>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
} 