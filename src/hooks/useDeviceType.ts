import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

interface UseDeviceTypeReturn {
    deviceType: DeviceType;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isPortrait: boolean;
}

export function useDeviceType(): UseDeviceTypeReturn {
    const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
    const [isPortrait, setIsPortrait] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const aspectRatio = width / height;

            // Update orientation
            setIsPortrait(height > width);

            // Determine device type based on width and aspect ratio
            // Mobile: Width <= 640px OR (Width <= 900px AND Portrait Mode - tailored for large phones/foldables)
            if (width <= 640 || (width <= 900 && height > width)) {
                setDeviceType('mobile');
            } 
            // Tablet: 640px < Width <= 1024px
            else if (width <= 1024) {
                setDeviceType('tablet');
            } 
            // Desktop: Width > 1024px
            else {
                setDeviceType('desktop');
            }
        };

        // Initial check
        handleResize();

        // Add event listener
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return {
        deviceType,
        isMobile: deviceType === 'mobile',
        isTablet: deviceType === 'tablet',
        isDesktop: deviceType === 'desktop',
        isPortrait
    };
}
