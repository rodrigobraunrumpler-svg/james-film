import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Sin `tailwind-merge`, una clase de variante y una de override se pisan de forma
 * impredecible: gana la que Tailwind haya puesto después en la hoja, no la última
 * que escribiste.
 */
export const cn = (...clases: ClassValue[]): string => twMerge(clsx(clases));
