'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import apiService from '@/services/apiService';

// Component content wrapped to be used inside Suspense
const SelectNumberContent = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const username = searchParams.get('username');
    const connectionId = searchParams.get('connectionId');

    const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [error, setError] = useState('');
    const [searchFilters, setSearchFilters] = useState({
        country_code: 'US',
        area_code: '',
        locality: '',
        administrative_area: ''
    });

    // Fetch initial numbers (general US search)
    useEffect(() => {
        if (!username || !connectionId) {
            setError('Missing registration data. Please try registering again.');
            return;
        }
        handleSearch();
    }, [username, connectionId]);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // Filter out empty strings
            const params: any = {};
            if (searchFilters.country_code) params.country_code = searchFilters.country_code;
            if (searchFilters.area_code) params.area_code = searchFilters.area_code;
            if (searchFilters.locality) params.locality = searchFilters.locality;
            if (searchFilters.administrative_area) params.administrative_area = searchFilters.administrative_area;

            const results = await apiService.searchPhoneNumbers(params);

            // Telnyx API returns data under 'data' key
            if (results && results.data) {
                setAvailableNumbers(results.data);
            } else {
                setAvailableNumbers([]);
            }
        } catch (err: any) {
            console.error('Search error:', err);
            setError('Failed to search numbers. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePurchase = async (phoneNumber: string) => {
        if (!confirm(`Are you sure you want to purchase ${phoneNumber}?`)) return;

        setIsPurchasing(true);
        setError('');

        try {
            await apiService.purchasePhoneNumber({
                phoneNumber,
                connectionId: connectionId!,
                username: username!
            });

            alert('Phone number purchased successfully!');
            router.push('/login'); // Or dashboard if you implement direct login
        } catch (err: any) {
            console.error('Purchase error:', err);
            setError(err.response?.data?.details?.detail || err.message || 'Failed to purchase number.');
        } finally {
            setIsPurchasing(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setSearchFilters({
            ...searchFilters,
            [e.target.name]: e.target.value
        });
    };

    if (!username || !connectionId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8 text-center">
                    <p className="text-red-600">Missing registration information.</p>
                    <button
                        onClick={() => router.push('/register')}
                        className="text-indigo-600 hover:text-indigo-500"
                    >
                        Back to Registration
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center">
                    <h2 className="text-3xl font-extrabold text-gray-900">Select Your Phone Number</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Choose a number for your account <b>{username}</b>
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                {/* Search Form */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label htmlFor="country_code" className="block text-sm font-medium text-gray-700">Country</label>
                            <select
                                id="country_code"
                                name="country_code"
                                value={searchFilters.country_code}
                                onChange={handleInputChange}
                                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                                <option value="US">United States</option>
                                <option value="CA">Canada</option>
                                <option value="GB">United Kingdom</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="area_code" className="block text-sm font-medium text-gray-700">Area Code</label>
                            <input
                                type="text"
                                name="area_code"
                                id="area_code"
                                value={searchFilters.area_code}
                                onChange={handleInputChange}
                                placeholder="e.g. 312"
                                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="locality" className="block text-sm font-medium text-gray-700">City</label>
                            <input
                                type="text"
                                name="locality"
                                id="locality"
                                value={searchFilters.locality}
                                onChange={handleInputChange}
                                placeholder="e.g. Chicago"
                                className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                            >
                                {isLoading ? 'Searching...' : 'Search'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Results List */}
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <ul className="divide-y divide-gray-200">
                        {availableNumbers.length === 0 && !isLoading ? (
                            <li className="px-6 py-4 text-center text-gray-500">No numbers found. Try different search criteria.</li>
                        ) : (
                            availableNumbers.map((number: any) => (
                                <li key={number.phone_number} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                                    <div className="flex items-center">
                                        <div className="text-lg font-medium text-indigo-600 font-mono">
                                            {number.phone_number}
                                        </div>
                                        <div className="ml-4 text-sm text-gray-500">
                                            {number.region_information?.[0]?.region_name}, {number.region_information?.[0]?.region_code}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handlePurchase(number.phone_number)}
                                        disabled={isPurchasing}
                                        className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                                    >
                                        {isPurchasing ? 'Processing...' : 'Buy'}
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
};

// Main page component with Suspense boundary
export default function SelectNumberPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <SelectNumberContent />
        </Suspense>
    );
}
