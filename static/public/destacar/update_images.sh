#!/bin/bash

# Script to update destacar carousel images

# Display help
usage() {
  echo "Usage: $0 [OPTIONS]"
  echo "Update one or all of the destacar carousel images."
  echo
  echo "Options:"
  echo "  -a, --all FOLDER    Replace all 6 images from FOLDER (should contain numbered images 1-6)"
  echo "  -i, --image N FILE  Replace image N (1-6) with FILE"
  echo "  -h, --help          Display this help and exit"
  echo
  echo "Examples:"
  echo "  $0 --all ~/my_new_images"
  echo "  $0 --image 3 ~/my_new_card.jpg"
}

# Check if no arguments were provided
if [ $# -eq 0 ]; then
  usage
  exit 1
fi

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      usage
      exit 0
      ;;
    -a|--all)
      if [ -z "$2" ]; then
        echo "Error: FOLDER argument required for --all option"
        exit 1
      fi
      SOURCE_FOLDER=$2
      ALL=true
      shift 2
      ;;
    -i|--image)
      if [ -z "$2" ] || [ -z "$3" ]; then
        echo "Error: Both N and FILE arguments required for --image option"
        exit 1
      fi
      IMAGE_NUMBER=$2
      IMAGE_FILE=$3
      ALL=false
      shift 3
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

# Set the destination folder
DEST_FOLDER="$(dirname "$0")"

# Replace all images
if [ "$ALL" = true ]; then
  if [ ! -d "$SOURCE_FOLDER" ]; then
    echo "Error: Source folder does not exist: $SOURCE_FOLDER"
    exit 1
  fi
  
  echo "Replacing all destacar images from $SOURCE_FOLDER"
  
  for i in {1..6}; do
    # Look for various possible filenames
    found=false
    for pattern in "$i.jpg" "$i.jpeg" "$i.png" "imagen_$i.jpg" "imagen_$i.jpeg" "imagen_$i.png"; do
      if [ -f "$SOURCE_FOLDER/$pattern" ]; then
        cp "$SOURCE_FOLDER/$pattern" "$DEST_FOLDER/imagen_$i.jpg"
        echo "Replaced imagen_$i.jpg"
        found=true
        break
      fi
    done
    
    if [ "$found" = false ]; then
      echo "Warning: No image found for position $i"
    fi
  done
  
  echo "Done! All destacar images updated."
  
# Replace a single image
else
  if ! [[ "$IMAGE_NUMBER" =~ ^[1-6]$ ]]; then
    echo "Error: Image number must be between 1 and 6"
    exit 1
  fi
  
  if [ ! -f "$IMAGE_FILE" ]; then
    echo "Error: Image file does not exist: $IMAGE_FILE"
    exit 1
  fi
  
  echo "Replacing destacar image $IMAGE_NUMBER with $IMAGE_FILE"
  cp "$IMAGE_FILE" "$DEST_FOLDER/imagen_$IMAGE_NUMBER.jpg"
  echo "Done! Image updated."
fi

# Make the script executable
chmod +x "$0" 