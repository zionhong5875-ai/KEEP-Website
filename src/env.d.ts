/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    language?: "zh" | "en";
    publicPathname?: string;
    indexable?: boolean;
  }
}
