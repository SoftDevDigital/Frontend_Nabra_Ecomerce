"use client";
import { useState } from "react";
import ImageGallery from 'react-image-gallery';
import 'react-image-gallery/styles/css/image-gallery.css';
import s from "./ImageGallery.module.css";

interface ImageGalleryProps {
  images: string[];
  productName: string;
}

export default function ProductImageGallery({ images, productName }: ImageGalleryProps) {
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className={s.noImages}>
        <p>No hay imágenes disponibles</p>
      </div>
    );
  }

  // Convertir las imágenes al formato que espera react-image-gallery
  const galleryImages = images.map((image, index) => ({
    original: image,
    thumbnail: image,
    originalAlt: `${productName} - Imagen ${index + 1}`,
    thumbnailAlt: `${productName} - Miniatura ${index + 1}`,
  }));

  const handleImageClick = (index: number) => {
    setCurrentImageIndex(index);
    setIsZoomModalOpen(true);
  };

  const closeZoomModal = () => {
    setIsZoomModalOpen(false);
  };

  const goToPrevious = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      closeZoomModal();
    }
    if (e.key === "ArrowLeft") goToPrevious();
    if (e.key === "ArrowRight") goToNext();
  };

  return (
    <div className={s.galleryContainer}>
      <ImageGallery
        items={galleryImages}
        showThumbnails={true}
        showFullscreenButton={false}
        showPlayButton={false}
        showNav={true}
        showBullets={false}
        autoPlay={false}
        slideInterval={3000}
        slideDuration={450}
        thumbnailPosition="bottom"
        useBrowserFullscreen={false}
        onSlide={(index) => setCurrentImageIndex(index)}
        renderItem={(item, index) => (
          <div className={s.imageWrapper} onClick={() => handleImageClick(index)}>
            <img
              src={item.original}
              alt={item.originalAlt}
              className={s.mainImage}
              loading="lazy"
            />
            <div className={s.zoomOverlay}>
              <div className={s.zoomIcon}>
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor" />
                </svg>
              </div>
            </div>
          </div>
        )}
        renderThumbInner={(item) => (
          <img
            src={item.thumbnail}
            alt={item.thumbnailAlt}
            className={s.thumbnailImage}
            loading="lazy"
          />
        )}
        renderLeftNav={(onClick, disabled) => (
          <button
            className={`${s.navButton} ${s.navLeft} ${disabled ? s.navDisabled : ''}`}
            onClick={onClick}
            disabled={disabled}
            aria-label="Imagen anterior"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />
            </svg>
          </button>
        )}
        renderRightNav={(onClick, disabled) => (
          <button
            className={`${s.navButton} ${s.navRight} ${disabled ? s.navDisabled : ''}`}
            onClick={onClick}
            disabled={disabled}
            aria-label="Imagen siguiente"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="currentColor" />
            </svg>
          </button>
        )}
      />

      {/* Modal de zoom */}
      {isZoomModalOpen && (
        <div className={s.zoomModal} onClick={closeZoomModal}>
          <div 
            className={s.zoomContent} 
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            {/* Imagen con zoom */}
            <div className={s.zoomImageContainer}>
              <img
                src={images[currentImageIndex]}
                alt={`${productName} - Imagen ${currentImageIndex + 1}`}
                className={s.zoomImage}
              />
            </div>

            {/* Navegación en modal */}
            {images.length > 1 && (
              <>
                <button
                  className={`${s.modalNavButton} ${s.modalNavLeft}`}
                  onClick={goToPrevious}
                  aria-label="Imagen anterior"
                >
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />
                  </svg>
                </button>
                <button
                  className={`${s.modalNavButton} ${s.modalNavRight}`}
                  onClick={goToNext}
                  aria-label="Imagen siguiente"
                >
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="currentColor" />
                  </svg>
                </button>
              </>
            )}

            {/* Botón cerrar */}
            <button
              className={s.closeButton}
              onClick={closeZoomModal}
              aria-label="Cerrar zoom"
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor" />
              </svg>
            </button>

            {/* Indicador de imagen en modal */}
            {images.length > 1 && (
              <div className={s.modalImageCounter}>
                {currentImageIndex + 1} / {images.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
