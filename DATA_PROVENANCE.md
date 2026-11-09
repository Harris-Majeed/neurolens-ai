# NeuroLens AI: data provenance

This file records where every dataset, derived file and model checkpoint in this repository comes from, what was done to it, and what is not known.

## 1. 2D classification data

- **Source:** Kaggle, "Brain Tumor MRI Dataset" by Masoud Nickparvar (https://www.kaggle.com/datasets/masoudnickparvar/brain-tumor-mri-dataset), license CC BY 4.0. The dataset page calls it a dataset for classifying brain tumors; its own page and discussion list its original sources (the card names Figshare, SARTAJ and Br35H collections), so check that card before relying on or redistributing the images. The URL is written from memory of the usual address, so confirm it against your browser.
- **File used:** `archive (2).zip`, 7,200 images in `Training/` and `Testing/` with four classes (glioma, meningioma, notumor, pituitary). Training has 1,400 images per class (5,600), Testing 400 per class (1,600).

- **Duplicates:** MD5 hashing found 7,013 unique files and 153 groups of byte-identical duplicates, all inside a single split (187 redundant copies). None were shared between Training and Testing, and no identical image carried two different labels. The first copy of each was kept.

- **Splits after de-duplication:** 4,614 train, 815 validation (stratified 85/15 split of the original Training folder, seed 42) and 1,584 test (glioma 386, meningioma 398, no tumor 400, pituitary 400). The file lists are in `docs/splits.csv` (paths are from the Colab session).

- **Image properties:** mixed sizes (63 distinct sizes in a random sample of 400, most 512 x 512), grayscale and RGB, mixed planes. Images are converted to RGB, resized to 224 x 224 and normalised with ImageNet statistics.

- **No patient identifiers.** Slices from one patient may appear in more than one split, so validation and test accuracy are probably optimistic.

- **Benchmark samples** (`frontend/samples`, five files): test-set images that the model classified correctly with the highest confidence in their class. They show the model at its best.

## 2. 3D segmentation data

- **Source:** BraTS 2023 adult glioma (GLI) challenge data, taken from the Hugging Face copy `MedOtter/brats2023-gli-dataset` (the page lists CC-BY-4.0). The original distribution is Synapse `syn51156910`, and the original challenge terms also apply. The Hugging Face copy is a third-party mirror and was not compared with the original.

- **Contents:** 1,251 scans from 1,133 patients, each with T1n, T1c, T2w and T2-FLAIR volumes and an expert mask (labels 0 background, 1 necrotic core, 2 edema, 3 enhancing tumor), 240 x 240 x 155 voxels at 1 mm. 118 patients have more than one scan.

- **Subset used:** 100 randomly chosen patients (seed 42), first scan of each, split by patient: 70 train, 15 validation, 15 test. The case lists are in `docs/splits.json`.

- **Preprocessing:** crop to the brain bounding box (plus a 2-voxel margin), clip each sequence at its 99.5th percentile inside the brain, z-score each sequence inside the brain, store as float16. Targets are the overlapping regions whole tumor (1, 2, 3), tumor core (1, 3) and enhancing tumor (3).

- **Demo cases** (`frontend/seg_demo`): four held-out test patients (BraTS-GLI-00263-000 best, 01426-000 median, 01204-000 lowest whole-tumor Dice, 01499-000 with no enhancing tumor in the expert mask). Each bundle holds FLAIR and T1c scaled to 8 bits, the model prediction and the expert mask, all derived from BraTS data.

## 3. Model checkpoints

| File | Model | Training | Selected by | SHA-256 |

|---|---|---|---|---|

| `models/NeuroScan_AI_resnet18.pth` | ResNet18, ImageNet-pretrained, 4 classes | 12 epochs, AdamW, one-cycle schedule, label smoothing 0.1 | best validation accuracy (0.9926 at epoch 7) | b7dcf1693484e409628d4331714f5e8736325ff11d53460b1f9f1c9a50e24893 |

| `models/NeuroScan_Seg3D_SegResNet.pth` | MONAI SegResNet, 4.7 million parameters | 120 epochs on 96-voxel patches, Dice + cross-entropy, AdamW with cosine schedule | best validation mean Dice (0.833 at epoch 64) | 5e087888086ebbfd92703897c6173b90ed7d2e9140562d3af733a3e10c5bb4b2 |

## 4. Reported results

- `docs/metrics_2d.json`: test accuracy, per-class metrics and confusion matrix of the classifier (1,584 test images).

- `docs/seg_test_metrics.json` and `docs/seg_test_per_patient.csv`: Dice, IoU, sensitivity, precision and volumes for the 15 test patients.

## 5. Not known or not done

- No patient identifiers for the 2D data, no age, sex, scanner or site information for either dataset, so subgroup performance is unknown.

- No external validation. Every result comes from one training run and one split.

- 2D uploads are not stored by the server. The 3D lab runs no live inference.

## 6. Before redistributing this repository

The repository contains trained weights, five 2D sample images and four BraTS-derived demo bundles. Check that the dataset licenses allow redistributing each of them, keep the attributions in the README, and remove anything they do not allow.
