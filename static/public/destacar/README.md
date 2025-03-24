# Destacar Images

This folder contains the fixed set of 6 images used for the destacar carousel on the homepage.

## File Naming Convention

Images follow a simple numeric naming scheme:
- `imagen_1.jpg` through `imagen_6.jpg`

## Usage

The destacar module in JavaScript automatically maps these images to the destacar cards in order of appearance. The first destacar card gets imagen_1.jpg, the second gets imagen_2.jpg, and so on.

If there are fewer than 6 destacar items, some images might not be used. If there's an error mapping images, imagen_1.jpg is used as a fallback.

## Changing Images

To update the visual appearance of the destacar carousel, simply replace these images with new ones, keeping the same filenames.

For best results, make sure all images have similar dimensions and aspect ratios. 