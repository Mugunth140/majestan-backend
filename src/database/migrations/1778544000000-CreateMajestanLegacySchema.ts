import { MigrationInterface, QueryRunner } from 'typeorm';

type LegacyIndexDefinition = {
  name: string;
  columns: string[];
  unique?: boolean;
};

type LegacyTableDefinition = {
  name: string;
  autoIncrement: number;
  columns: string[];
  indexes: LegacyIndexDefinition[];
};

const legacyTables: LegacyTableDefinition[] = [
  {
    "name": "login",
    "autoIncrement": 2,
    "columns": [
      "`id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`username` varchar(100) NULL",
      "`password` varchar(255) NOT NULL",
      "`status` tinyint(4) NOT NULL DEFAULT 1",
      "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
      "`role` varchar(32) NOT NULL DEFAULT 'admin'",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP"
    ],
    "indexes": [
      {
        "name": "uq_login_username",
        "columns": [
          "username"
        ],
        "unique": true
      },
      {
        "name": "idx_login_status",
        "columns": [
          "status"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "blogs",
    "autoIncrement": 55,
    "columns": [
      "`id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` date NULL",
      "`blog_title` varchar(255) NULL",
      "`blog_content` mediumtext NULL",
      "`blog_image` varchar(100) NULL",
      "`meta_title` varchar(100) DEFAULT NULL",
      "`meta_keywords` text DEFAULT NULL",
      "`slug_url` text DEFAULT NULL",
      "`meta_description` text DEFAULT NULL",
      "`status` tinyint(4) NOT NULL DEFAULT 1",
      "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
      "`views` int(11) DEFAULT 0",
      "`likes` int(11) DEFAULT 0",
      "`title` varchar(255) NULL",
      "`slug` varchar(255) NULL",
      "`image` varchar(500) NULL",
      "`content` longtext NULL",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP"
    ],
    "indexes": [
      {
        "name": "idx_blogs_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_blogs_slug",
        "columns": [
          "slug"
        ],
        "unique": false
      },
      {
        "name": "idx_blogs_blog_title",
        "columns": [
          "blog_title"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "banner",
    "autoIncrement": 25,
    "columns": [
      "`id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` date NULL",
      "`banner_type` int(11) DEFAULT NULL",
      "`banner_link` text DEFAULT NULL",
      "`banner_image` varchar(100) NULL",
      "`status` tinyint(4) NOT NULL DEFAULT 1",
      "`title` varchar(255) NULL",
      "`image` varchar(500) NULL",
      "`redirect_url` varchar(500) NULL",
      "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP"
    ],
    "indexes": [
      {
        "name": "idx_banner_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_banner_type",
        "columns": [
          "banner_type"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "business_setup",
    "autoIncrement": 2,
    "columns": [
      "`id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(100) NULL",
      "`trip_commission` varchar(100) DEFAULT NULL",
      "`gst` varchar(100) DEFAULT NULL",
      "`search_radius` varchar(100) DEFAULT NULL",
      "`driver_completion_radius` varchar(100) DEFAULT NULL",
      "`status` tinyint(4) NOT NULL DEFAULT 1",
      "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
      "`company_name` varchar(255) NULL",
      "`phone` varchar(64) NULL",
      "`email` varchar(255) NULL",
      "`website` varchar(255) NULL",
      "`logo` varchar(500) NULL",
      "`settings` json NULL",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP"
    ],
    "indexes": [
      {
        "name": "idx_business_setup_status",
        "columns": [
          "status"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "business_profile",
    "autoIncrement": 2,
    "columns": [
      "`id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(100) NULL",
      "`business_name` varchar(100) DEFAULT NULL",
      "`business_contact_number` varchar(100) DEFAULT NULL",
      "`business_contact_email` varchar(100) DEFAULT NULL",
      "`business_address` varchar(100) DEFAULT NULL",
      "`business_support_number` varchar(100) DEFAULT NULL",
      "`business_support_email` varchar(100) DEFAULT NULL",
      "`trade_license_number` varchar(100) DEFAULT NULL",
      "`status` tinyint(4) NOT NULL DEFAULT 1",
      "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
      "`company_name` varchar(255) NULL",
      "`address` text NULL",
      "`phone` varchar(64) NULL",
      "`email` varchar(255) NULL",
      "`website` varchar(255) NULL",
      "`about` longtext NULL",
      "`social` json NULL",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP"
    ],
    "indexes": [
      {
        "name": "idx_business_profile_status",
        "columns": [
          "status"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "enquiry",
    "autoIncrement": 272,
    "columns": [
      "`id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` date NULL",
      "`name` varchar(100) NULL",
      "`propertydetail` varchar(100) DEFAULT NULL",
      "`propertyid` varchar(100) DEFAULT NULL",
      "`propertytype` varchar(100) DEFAULT NULL",
      "`mobileno` varchar(100) NULL",
      "`email` varchar(100) NULL",
      "`requirement` varchar(255) NULL",
      "`status` tinyint(4) NOT NULL DEFAULT 1",
      "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
      "`phone` varchar(32) NULL",
      "`property_type` varchar(100) NULL",
      "`purchase_type` varchar(32) NULL",
      "`listing_type` varchar(32) NULL",
      "`budget` varchar(64) NULL",
      "`message` text NULL",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP"
    ],
    "indexes": [
      {
        "name": "idx_enquiry_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_enquiry_property_type",
        "columns": [
          "property_type"
        ],
        "unique": false
      },
      {
        "name": "idx_enquiry_propertytype",
        "columns": [
          "propertytype"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "propertydetails",
    "autoIncrement": 66,
    "columns": [
      "`id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` date NULL",
      "`name` varchar(100) NULL",
      "`location` varchar(100) NULL",
      "`dealtype` varchar(100) NULL",
      "`propertytype` varchar(100) NULL",
      "`mobilenumber` varchar(100) DEFAULT NULL",
      "`size` varchar(100) NULL",
      "`rooms` varchar(100) NULL",
      "`ageofproperty` varchar(100) NULL",
      "`furnishing_status` varchar(100) NULL",
      "`propertycondition` varchar(100) NULL",
      "`price` varchar(100) NULL",
      "`property_details` varchar(100) NULL",
      "`file` varchar(100) NULL",
      "`status` tinyint(4) NOT NULL DEFAULT 1",
      "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
      "`email` varchar(255) NULL",
      "`phone` varchar(32) NULL",
      "`property_type` varchar(100) NULL",
      "`listing_type` varchar(32) NULL",
      "`message` text NULL",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP"
    ],
    "indexes": [
      {
        "name": "idx_propertydetails_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_propertydetails_property_type",
        "columns": [
          "property_type"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "wishlist",
    "autoIncrement": 336,
    "columns": [
      "`id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`user_id` varchar(100) DEFAULT NULL",
      "`property_type` varchar(100) NULL",
      "`property_id` varchar(100) NULL",
      "`wish_date` datetime DEFAULT CURRENT_TIMESTAMP",
      "`status` int(11) NOT NULL DEFAULT 1",
      "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP"
    ],
    "indexes": [
      {
        "name": "idx_wishlist_user",
        "columns": [
          "user_id"
        ],
        "unique": false
      },
      {
        "name": "idx_wishlist_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_wishlist_property",
        "columns": [
          "property_id",
          "property_type"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "sublocations",
    "autoIncrement": 128,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(255) NULL",
      "`sublocation` varchar(255) NULL",
      "`status` int(11) NOT NULL DEFAULT 1",
      "`created_at` timestamp NULL DEFAULT NULL",
      "`updated_at` timestamp NULL DEFAULT NULL"
    ],
    "indexes": [
      {
        "name": "idx_sublocations_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_sublocations_name",
        "columns": [
          "sublocation"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "unittypes",
    "autoIncrement": 9,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(255) NULL",
      "`unittype` varchar(255) NULL",
      "`status` int(11) NOT NULL DEFAULT 1",
      "`created_at` timestamp NULL DEFAULT NULL",
      "`updated_at` timestamp NULL DEFAULT NULL"
    ],
    "indexes": [
      {
        "name": "idx_unittypes_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_unittypes_name",
        "columns": [
          "unittype"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "ageproperties",
    "autoIncrement": 14,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(255) NULL",
      "`ageproperty` varchar(255) NULL",
      "`status` int(11) NOT NULL DEFAULT 1",
      "`created_at` timestamp NULL DEFAULT NULL",
      "`updated_at` timestamp NULL DEFAULT NULL"
    ],
    "indexes": [
      {
        "name": "idx_ageproperties_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_ageproperties_name",
        "columns": [
          "ageproperty"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "facing_directions",
    "autoIncrement": 7,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(255) NULL",
      "`facing` varchar(255) NULL",
      "`status` int(11) NOT NULL DEFAULT 1",
      "`created_at` timestamp NULL DEFAULT NULL",
      "`updated_at` timestamp NULL DEFAULT NULL"
    ],
    "indexes": [
      {
        "name": "idx_facing_directions_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_facing_directions_name",
        "columns": [
          "facing"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "floors",
    "autoIncrement": 28,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(255) NULL",
      "`floor` varchar(255) NULL",
      "`status` int(11) NOT NULL DEFAULT 1",
      "`created_at` timestamp NULL DEFAULT NULL",
      "`updated_at` timestamp NULL DEFAULT NULL"
    ],
    "indexes": [
      {
        "name": "idx_floors_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_floors_name",
        "columns": [
          "floor"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "furnishings",
    "autoIncrement": 6,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(255) NULL",
      "`furnishing` varchar(255) NULL",
      "`status` int(11) NOT NULL DEFAULT 1",
      "`created_at` timestamp NULL DEFAULT NULL",
      "`updated_at` timestamp NULL DEFAULT NULL"
    ],
    "indexes": [
      {
        "name": "idx_furnishings_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_furnishings_name",
        "columns": [
          "furnishing"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "propertyuses",
    "autoIncrement": 11,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(255) NULL",
      "`propertyuse` varchar(255) NULL",
      "`status` int(11) NOT NULL DEFAULT 1",
      "`created_at` timestamp NULL DEFAULT NULL",
      "`updated_at` timestamp NULL DEFAULT NULL"
    ],
    "indexes": [
      {
        "name": "idx_propertyuses_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_propertyuses_name",
        "columns": [
          "propertyuse"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "apartment",
    "autoIncrement": 307,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(50) DEFAULT NULL",
      "`apartment_code` varchar(50) DEFAULT NULL",
      "`posttype` varchar(50) DEFAULT NULL",
      "`propertytype` varchar(50) DEFAULT NULL",
      "`propertyname` text DEFAULT NULL",
      "`address` text DEFAULT NULL",
      "`sublocation` varchar(50) DEFAULT NULL",
      "`roadaccess` text DEFAULT NULL",
      "`roadname` text DEFAULT NULL",
      "`transactiontype` text DEFAULT NULL",
      "`handover_date` text DEFAULT NULL",
      "`tower_nos` text DEFAULT NULL",
      "`plot_area` text DEFAULT NULL",
      "`unittype` varchar(50) DEFAULT NULL",
      "`unit_number` text DEFAULT NULL",
      "`flat_nos` text DEFAULT NULL",
      "`facing` varchar(100) DEFAULT NULL",
      "`total_floors` text DEFAULT NULL",
      "`floor` varchar(50) DEFAULT NULL",
      "`carpet_area` text DEFAULT NULL",
      "`build_up_area` text DEFAULT NULL",
      "`super_build_up_area` text DEFAULT NULL",
      "`uds_area` text DEFAULT NULL",
      "`parking1` text DEFAULT NULL",
      "`parking2` text DEFAULT NULL",
      "`guest_parking` text DEFAULT NULL",
      "`furnishing_status` text DEFAULT NULL",
      "`pooja` text DEFAULT NULL",
      "`study_store` text DEFAULT NULL",
      "`property_age` varchar(50) DEFAULT NULL",
      "`amenities` text DEFAULT NULL",
      "`tenant_occupied` text DEFAULT NULL",
      "`ownername` text DEFAULT NULL",
      "`ownermobileno` text DEFAULT NULL",
      "`owneremail` text DEFAULT NULL",
      "`alternatename` text DEFAULT NULL",
      "`alternatemobileno` text DEFAULT NULL",
      "`alternateemail` text DEFAULT NULL",
      "`ownershiptype` text DEFAULT NULL",
      "`availabledate` text DEFAULT NULL",
      "`availabletime` text DEFAULT NULL",
      "`price` text DEFAULT NULL",
      "`expectedsaleprice` varchar(50) DEFAULT NULL",
      "`sale` text DEFAULT NULL",
      "`registration_time` text DEFAULT NULL",
      "`saleprice_units` text DEFAULT NULL",
      "`maintenance_charge` text DEFAULT NULL",
      "`negoitable` text DEFAULT NULL",
      "`registration_charge` text DEFAULT NULL",
      "`payment_mode` text DEFAULT NULL",
      "`monthly_rent` varchar(100) DEFAULT NULL",
      "`security_deposit` text DEFAULT NULL",
      "`lock_period` text DEFAULT NULL",
      "`taxes` text DEFAULT NULL",
      "`ownershiptitle` text DEFAULT NULL",
      "`encumbrance_certificate` text DEFAULT NULL",
      "`rental_aggrement` text DEFAULT NULL",
      "`document_require` text DEFAULT NULL",
      "`tslr` text DEFAULT NULL",
      "`tax_receipt` text DEFAULT NULL",
      "`eb_receipt` text DEFAULT NULL",
      "`market_price1` text DEFAULT NULL",
      "`market_price2` text DEFAULT NULL",
      "`comparative_price` text DEFAULT NULL",
      "`rental_yield` text DEFAULT NULL",
      "`demand_area` text DEFAULT NULL",
      "`agentname` text DEFAULT NULL",
      "`agencyname` text DEFAULT NULL",
      "`contactdetail` text DEFAULT NULL",
      "`commission_terms` text DEFAULT NULL",
      "`latitude_longitude` text DEFAULT NULL",
      "`photo1` text DEFAULT NULL",
      "`photo2` text DEFAULT NULL",
      "`photo3` text DEFAULT NULL",
      "`photo4` text DEFAULT NULL",
      "`photo5` text DEFAULT NULL",
      "`photo6` text DEFAULT NULL",
      "`photo7` text DEFAULT NULL",
      "`photo8` text DEFAULT NULL",
      "`photo9` text DEFAULT NULL",
      "`photo10` text DEFAULT NULL",
      "`remark` text DEFAULT NULL",
      "`attachment1` text DEFAULT NULL",
      "`attachment2` text DEFAULT NULL",
      "`attachment3` text DEFAULT NULL",
      "`attachment4` text DEFAULT NULL",
      "`attachment5` text DEFAULT NULL",
      "`attachment6` text DEFAULT NULL",
      "`view` text DEFAULT NULL",
      "`flooring` text DEFAULT NULL",
      "`lift` text DEFAULT NULL",
      "`power_backup` text DEFAULT NULL",
      "`launch_date` text DEFAULT NULL",
      "`stair_case` text DEFAULT NULL",
      "`boundary_wall` text DEFAULT NULL",
      "`key_highlight` text NULL",
      "`youtube_url` text NULL",
      "`booking_status` int(11) DEFAULT NULL",
      "`featured_property` tinyint(4) NOT NULL DEFAULT 0",
      "`meta_title` text DEFAULT NULL",
      "`meta_keywords` text NULL",
      "`meta_description` text NULL",
      "`slug_url` varchar(255) DEFAULT NULL",
      "`status` varchar(10) DEFAULT NULL",
      "`update_status` text DEFAULT NULL",
      "`created_by` text DEFAULT NULL",
      "`created_at` timestamp NULL DEFAULT NULL",
      "`updated_at` timestamp NULL DEFAULT NULL"
    ],
    "indexes": [
      {
        "name": "idx_apartment_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_apartment_posttype",
        "columns": [
          "posttype"
        ],
        "unique": false
      },
      {
        "name": "idx_apartment_sublocation",
        "columns": [
          "sublocation"
        ],
        "unique": false
      },
      {
        "name": "idx_apartment_floor",
        "columns": [
          "floor"
        ],
        "unique": false
      },
      {
        "name": "idx_apartment_unittype",
        "columns": [
          "unittype"
        ],
        "unique": false
      },
      {
        "name": "idx_apartment_expectedsaleprice",
        "columns": [
          "expectedsaleprice"
        ],
        "unique": false
      },
      {
        "name": "idx_apartment_monthly_rent",
        "columns": [
          "monthly_rent"
        ],
        "unique": false
      },
      {
        "name": "idx_apartment_facing",
        "columns": [
          "facing"
        ],
        "unique": false
      },
      {
        "name": "idx_apartment_property_age",
        "columns": [
          "property_age"
        ],
        "unique": false
      },
      {
        "name": "idx_apartment_booking_status",
        "columns": [
          "booking_status"
        ],
        "unique": false
      },
      {
        "name": "idx_apartment_featured_property",
        "columns": [
          "featured_property"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "villas",
    "autoIncrement": 82,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(50) DEFAULT NULL",
      "`villa_code` varchar(50) DEFAULT NULL",
      "`posttype` varchar(50) DEFAULT NULL",
      "`propertytype` varchar(50) DEFAULT NULL",
      "`propertyname` text DEFAULT NULL",
      "`address` text DEFAULT NULL",
      "`sublocation` varchar(50) DEFAULT NULL",
      "`roadaccess` text DEFAULT NULL",
      "`roadname` text DEFAULT NULL",
      "`sale` text DEFAULT NULL",
      "`transaction_type` text DEFAULT NULL",
      "`handover_date` text DEFAULT NULL",
      "`villa_nos` text DEFAULT NULL",
      "`villa_area` text DEFAULT NULL",
      "`villa_dimension` text DEFAULT NULL",
      "`plot_area` text DEFAULT NULL",
      "`plot_dimension` text DEFAULT NULL",
      "`buildup_area` varchar(50) DEFAULT NULL",
      "`floor_nos` text DEFAULT NULL",
      "`configuration` varchar(50) DEFAULT NULL",
      "`living_room` text DEFAULT NULL",
      "`dining_area` text DEFAULT NULL",
      "`master_bedroom` text DEFAULT NULL",
      "`bedroom2` text DEFAULT NULL",
      "`bedroom3` text DEFAULT NULL",
      "`bedroom4` text DEFAULT NULL",
      "`bathroom_nos` text DEFAULT NULL",
      "`bathroom1` text DEFAULT NULL",
      "`balcony_nos` text DEFAULT NULL",
      "`balcony1` text DEFAULT NULL",
      "`furnishing_status` text DEFAULT NULL",
      "`property_age` varchar(50) DEFAULT NULL",
      "`architectural_style` text DEFAULT NULL",
      "`amentities` text DEFAULT NULL",
      "`ownername` text DEFAULT NULL",
      "`ownermobileno` text DEFAULT NULL",
      "`owneremail` text DEFAULT NULL",
      "`alternatename` text DEFAULT NULL",
      "`alternatemobileno` text DEFAULT NULL",
      "`alternateemail` text DEFAULT NULL",
      "`ownershiptype` text DEFAULT NULL",
      "`availabledate` text DEFAULT NULL",
      "`availabletime` text DEFAULT NULL",
      "`outdoor_spaces` text DEFAULT NULL",
      "`vehicleparking_nos` text DEFAULT NULL",
      "`facing_direction` varchar(50) DEFAULT NULL",
      "`utilities_provided` text DEFAULT NULL",
      "`community_facilities` text DEFAULT NULL",
      "`price` text DEFAULT NULL",
      "`expectedsaleprice` varchar(50) DEFAULT NULL",
      "`sales` text DEFAULT NULL",
      "`registration_time` text DEFAULT NULL",
      "`hypothication` text DEFAULT NULL",
      "`negoitable` text DEFAULT NULL",
      "`registration_charge` text DEFAULT NULL",
      "`payment_mode` text DEFAULT NULL",
      "`monthly_rent` varchar(50) DEFAULT NULL",
      "`security_deposit` text DEFAULT NULL",
      "`maintenance_charge` text DEFAULT NULL",
      "`lockin_period` text DEFAULT NULL",
      "`taxes` text DEFAULT NULL",
      "`ownershiptitle` text DEFAULT NULL",
      "`encumbrance_certificate` text DEFAULT NULL",
      "`rental_aggrement` text DEFAULT NULL",
      "`documentrequired_resale` text DEFAULT NULL",
      "`tslr` text DEFAULT NULL",
      "`tax_receipt` text DEFAULT NULL",
      "`eb_receipt` text DEFAULT NULL",
      "`comparative_price` text DEFAULT NULL",
      "`rental_yield` text DEFAULT NULL",
      "`demand_area` text DEFAULT NULL",
      "`agentname` text DEFAULT NULL",
      "`agencyname` text DEFAULT NULL",
      "`contact_detail` text DEFAULT NULL",
      "`commission_terms` text DEFAULT NULL",
      "`latitude_longitude` text DEFAULT NULL",
      "`photo1` text DEFAULT NULL",
      "`photo2` text DEFAULT NULL",
      "`photo3` text DEFAULT NULL",
      "`photo4` text DEFAULT NULL",
      "`photo5` text DEFAULT NULL",
      "`photo6` text DEFAULT NULL",
      "`photo7` text DEFAULT NULL",
      "`photo8` text DEFAULT NULL",
      "`photo9` text DEFAULT NULL",
      "`photo10` text DEFAULT NULL",
      "`remark` text DEFAULT NULL",
      "`attachment1` text DEFAULT NULL",
      "`attachment2` text DEFAULT NULL",
      "`attachment3` text DEFAULT NULL",
      "`attachment4` text DEFAULT NULL",
      "`attachment5` text DEFAULT NULL",
      "`attachment6` text DEFAULT NULL",
      "`view` text DEFAULT NULL",
      "`flooring` text DEFAULT NULL",
      "`power_backup` text DEFAULT NULL",
      "`wall_status` text DEFAULT NULL",
      "`amenities` text DEFAULT NULL",
      "`youtube_url` text NULL",
      "`key_highlight` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL",
      "`meta_title` text DEFAULT NULL",
      "`meta_keywords` text NULL",
      "`meta_description` text NULL",
      "`slug_url` varchar(255) DEFAULT NULL",
      "`booking_status` int(11) DEFAULT NULL",
      "`featured_property` tinyint(4) NOT NULL DEFAULT 0",
      "`status` varchar(10) DEFAULT NULL",
      "`update_status` text DEFAULT NULL",
      "`floor` varchar(50) NULL",
      "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP"
    ],
    "indexes": [
      {
        "name": "idx_villas_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_villas_posttype",
        "columns": [
          "posttype"
        ],
        "unique": false
      },
      {
        "name": "idx_villas_sublocation",
        "columns": [
          "sublocation"
        ],
        "unique": false
      },
      {
        "name": "idx_villas_configuration",
        "columns": [
          "configuration"
        ],
        "unique": false
      },
      {
        "name": "idx_villas_property_age",
        "columns": [
          "property_age"
        ],
        "unique": false
      },
      {
        "name": "idx_villas_expectedsaleprice",
        "columns": [
          "expectedsaleprice"
        ],
        "unique": false
      },
      {
        "name": "idx_villas_monthly_rent",
        "columns": [
          "monthly_rent"
        ],
        "unique": false
      },
      {
        "name": "idx_villas_facing_direction",
        "columns": [
          "facing_direction"
        ],
        "unique": false
      },
      {
        "name": "idx_villas_floor",
        "columns": [
          "floor"
        ],
        "unique": false
      },
      {
        "name": "idx_villas_booking_status",
        "columns": [
          "booking_status"
        ],
        "unique": false
      },
      {
        "name": "idx_villas_featured_property",
        "columns": [
          "featured_property"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "individual_portions",
    "autoIncrement": 149,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(50) DEFAULT NULL",
      "`individual_space_code` varchar(50) DEFAULT NULL",
      "`posttype` varchar(50) DEFAULT NULL",
      "`propertytype` varchar(50) DEFAULT NULL",
      "`propertyname` text DEFAULT NULL",
      "`address` text DEFAULT NULL",
      "`sublocation` varchar(50) DEFAULT NULL",
      "`roadaccess` text DEFAULT NULL",
      "`roadname` text DEFAULT NULL",
      "`sale` text DEFAULT NULL",
      "`transaction_type` text DEFAULT NULL",
      "`handover_date` text DEFAULT NULL",
      "`plot_area` text DEFAULT NULL",
      "`plot_dimension` text DEFAULT NULL",
      "`buildup_area` varchar(50) DEFAULT NULL",
      "`floor_nos` text DEFAULT NULL",
      "`configuration` varchar(50) DEFAULT NULL",
      "`living_room` text DEFAULT NULL",
      "`dining_area` text DEFAULT NULL",
      "`master_bedroom` text DEFAULT NULL",
      "`bedroom2` text DEFAULT NULL",
      "`bedroom3` text DEFAULT NULL",
      "`bedroom4` text DEFAULT NULL",
      "`bathroom_nos` text DEFAULT NULL",
      "`bathroom1` text DEFAULT NULL",
      "`balcony_nos` text DEFAULT NULL",
      "`balcony1` text DEFAULT NULL",
      "`furnishing_status` text DEFAULT NULL",
      "`property_age` varchar(50) DEFAULT NULL",
      "`architectural_style` text DEFAULT NULL",
      "`ownername` text DEFAULT NULL",
      "`ownermobileno` text DEFAULT NULL",
      "`owneremail` text DEFAULT NULL",
      "`alternatename` text DEFAULT NULL",
      "`alternatemobileno` text DEFAULT NULL",
      "`alternateemail` text DEFAULT NULL",
      "`ownershiptype` text DEFAULT NULL",
      "`availabledate` text DEFAULT NULL",
      "`availabletime` text DEFAULT NULL",
      "`available_portion` text DEFAULT NULL",
      "`parking` text DEFAULT NULL",
      "`utilities_provided` text DEFAULT NULL",
      "`outdoor_spaces` text DEFAULT NULL",
      "`neighborhood_highlight` text DEFAULT NULL",
      "`price` text DEFAULT NULL",
      "`monthly_rent` varchar(50) DEFAULT NULL",
      "`security_deposit` text DEFAULT NULL",
      "`maintenance_charge` text DEFAULT NULL",
      "`lock_period` text DEFAULT NULL",
      "`taxes` text DEFAULT NULL",
      "`lease_term` text DEFAULT NULL",
      "`expectedsaleprice` varchar(50) DEFAULT NULL",
      "`sales` text DEFAULT NULL",
      "`registration_time` text DEFAULT NULL",
      "`negoitable` text DEFAULT NULL",
      "`registration_charge` text DEFAULT NULL",
      "`payment_mode` text DEFAULT NULL",
      "`ownershiptitle` text DEFAULT NULL",
      "`encumbrance_certificate` text DEFAULT NULL",
      "`rental_aggrement` text DEFAULT NULL",
      "`tslr` text DEFAULT NULL",
      "`tax_receipt` text DEFAULT NULL",
      "`eb_receipt` text DEFAULT NULL",
      "`comparative_price` text DEFAULT NULL",
      "`rental_yield` text DEFAULT NULL",
      "`demand_area` text DEFAULT NULL",
      "`agentname` text DEFAULT NULL",
      "`agencyname` text DEFAULT NULL",
      "`contact_detail` text DEFAULT NULL",
      "`commission_terms` text DEFAULT NULL",
      "`latitude_longitude` text DEFAULT NULL",
      "`photo1` text DEFAULT NULL",
      "`photo2` text DEFAULT NULL",
      "`photo3` text DEFAULT NULL",
      "`photo4` text DEFAULT NULL",
      "`photo5` text DEFAULT NULL",
      "`photo6` text DEFAULT NULL",
      "`photo7` text DEFAULT NULL",
      "`photo8` text DEFAULT NULL",
      "`photo9` text DEFAULT NULL",
      "`photo10` text DEFAULT NULL",
      "`attachment1` text DEFAULT NULL",
      "`attachment2` text DEFAULT NULL",
      "`attachment3` text DEFAULT NULL",
      "`attachment4` text DEFAULT NULL",
      "`attachment5` text DEFAULT NULL",
      "`attachment6` text DEFAULT NULL",
      "`flooring` text DEFAULT NULL",
      "`wall_status` text DEFAULT NULL",
      "`facing` varchar(100) NULL",
      "`youtube_url` text NULL",
      "`key_highlight` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL",
      "`remark` text DEFAULT NULL",
      "`meta_title` text DEFAULT NULL",
      "`meta_keywords` text NULL",
      "`slug_url` text DEFAULT NULL",
      "`meta_description` text NULL",
      "`status` int(11) DEFAULT NULL",
      "`booking_status` int(11) DEFAULT NULL",
      "`update_status` int(11) DEFAULT NULL",
      "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP"
    ],
    "indexes": [
      {
        "name": "idx_individual_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_individual_posttype",
        "columns": [
          "posttype"
        ],
        "unique": false
      },
      {
        "name": "idx_individual_sublocation",
        "columns": [
          "sublocation"
        ],
        "unique": false
      },
      {
        "name": "idx_individual_configuration",
        "columns": [
          "configuration"
        ],
        "unique": false
      },
      {
        "name": "idx_individual_property_age",
        "columns": [
          "property_age"
        ],
        "unique": false
      },
      {
        "name": "idx_individual_monthly_rent",
        "columns": [
          "monthly_rent"
        ],
        "unique": false
      },
      {
        "name": "idx_individual_expectedsaleprice",
        "columns": [
          "expectedsaleprice"
        ],
        "unique": false
      },
      {
        "name": "idx_individual_facing",
        "columns": [
          "facing"
        ],
        "unique": false
      },
      {
        "name": "idx_individual_booking_status",
        "columns": [
          "booking_status"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "plots",
    "autoIncrement": 106,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(50) DEFAULT NULL",
      "`plot_code` varchar(50) DEFAULT NULL",
      "`posttype` varchar(50) DEFAULT NULL",
      "`propertytype` varchar(50) DEFAULT NULL",
      "`propertyname` text DEFAULT NULL",
      "`address` text DEFAULT NULL",
      "`sublocation` varchar(50) DEFAULT NULL",
      "`roadaccess` text DEFAULT NULL",
      "`roadname` text DEFAULT NULL",
      "`sale` text DEFAULT NULL",
      "`total_area` varchar(50) DEFAULT NULL",
      "`dimensions` text DEFAULT NULL",
      "`facing_direction` varchar(50) DEFAULT NULL",
      "`surrounding_infrastructure` text DEFAULT NULL",
      "`project_area` varchar(50) DEFAULT NULL",
      "`plot_nos` text DEFAULT NULL",
      "`zoning_usage` text DEFAULT NULL",
      "`plot_type` text DEFAULT NULL",
      "`connectivity` text DEFAULT NULL",
      "`utilities_available` text DEFAULT NULL",
      "`ownername` text DEFAULT NULL",
      "`ownermobileno` text DEFAULT NULL",
      "`owneremail` text DEFAULT NULL",
      "`alternatename` text DEFAULT NULL",
      "`alternatemobileno` text DEFAULT NULL",
      "`alternateemail` text DEFAULT NULL",
      "`ownershiptype` text DEFAULT NULL",
      "`availabledate` text DEFAULT NULL",
      "`availabletime` text DEFAULT NULL",
      "`price` text DEFAULT NULL",
      "`monthly_rent` varchar(100) DEFAULT NULL",
      "`expectedsaleprice` varchar(50) DEFAULT NULL",
      "`sales` text DEFAULT NULL",
      "`registration_time` text DEFAULT NULL",
      "`negoitable` text DEFAULT NULL",
      "`registration_charge` text DEFAULT NULL",
      "`advance_payment` text DEFAULT NULL",
      "`loan_option` text DEFAULT NULL",
      "`maintenance_charge` text DEFAULT NULL",
      "`ownershiptitle` text DEFAULT NULL",
      "`encumbrance_certificate` text DEFAULT NULL",
      "`rental_aggrement` text DEFAULT NULL",
      "`patta_chitta` text DEFAULT NULL",
      "`approvals` text DEFAULT NULL",
      "`tslr` text DEFAULT NULL",
      "`tax_receipt` text DEFAULT NULL",
      "`eb_receipt` text DEFAULT NULL",
      "`agentname` text DEFAULT NULL",
      "`agencyname` text DEFAULT NULL",
      "`contact_detail` text DEFAULT NULL",
      "`commission_terms` text DEFAULT NULL",
      "`latitude_longitude` text DEFAULT NULL",
      "`photo1` text DEFAULT NULL",
      "`photo2` text DEFAULT NULL",
      "`photo3` text DEFAULT NULL",
      "`photo4` text DEFAULT NULL",
      "`photo5` text DEFAULT NULL",
      "`photo6` text DEFAULT NULL",
      "`photo7` text DEFAULT NULL",
      "`photo8` text DEFAULT NULL",
      "`photo9` text DEFAULT NULL",
      "`photo10` text DEFAULT NULL",
      "`remark` text DEFAULT NULL",
      "`attachment1` text DEFAULT NULL",
      "`attachment2` text DEFAULT NULL",
      "`attachment3` text DEFAULT NULL",
      "`attachment4` text DEFAULT NULL",
      "`attachment5` text DEFAULT NULL",
      "`attachment6` text DEFAULT NULL",
      "`launch_date` text DEFAULT NULL",
      "`rera_id` text DEFAULT NULL",
      "`cornor_plot` text DEFAULT NULL",
      "`cons_start` text DEFAULT NULL",
      "`youtube_url` text NULL",
      "`key_highlight` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL",
      "`booking_status` int(11) DEFAULT NULL",
      "`meta_title` text DEFAULT NULL",
      "`meta_keywords` text DEFAULT NULL",
      "`meta_description` text DEFAULT NULL",
      "`slug_url` text DEFAULT NULL",
      "`status` varchar(10) DEFAULT NULL",
      "`update_status` text DEFAULT NULL",
      "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP"
    ],
    "indexes": [
      {
        "name": "idx_plots_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_plots_posttype",
        "columns": [
          "posttype"
        ],
        "unique": false
      },
      {
        "name": "idx_plots_propertytype",
        "columns": [
          "propertytype"
        ],
        "unique": false
      },
      {
        "name": "idx_plots_sublocation",
        "columns": [
          "sublocation"
        ],
        "unique": false
      },
      {
        "name": "idx_plots_total_area",
        "columns": [
          "total_area"
        ],
        "unique": false
      },
      {
        "name": "idx_plots_facing_direction",
        "columns": [
          "facing_direction"
        ],
        "unique": false
      },
      {
        "name": "idx_plots_project_area",
        "columns": [
          "project_area"
        ],
        "unique": false
      },
      {
        "name": "idx_plots_expectedsaleprice",
        "columns": [
          "expectedsaleprice"
        ],
        "unique": false
      },
      {
        "name": "idx_plots_monthly_rent",
        "columns": [
          "monthly_rent"
        ],
        "unique": false
      },
      {
        "name": "idx_plots_booking_status",
        "columns": [
          "booking_status"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "farmlands",
    "autoIncrement": 13,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(255) DEFAULT NULL",
      "`farm_land_code` varchar(100) DEFAULT NULL",
      "`posttype` varchar(100) DEFAULT NULL",
      "`propertytype` varchar(255) DEFAULT NULL",
      "`propertyname` text DEFAULT NULL",
      "`address` text DEFAULT NULL",
      "`sublocation` varchar(255) DEFAULT NULL",
      "`roadaccess` text DEFAULT NULL",
      "`roadname` text DEFAULT NULL",
      "`sale` text DEFAULT NULL",
      "`totalarea` varchar(100) DEFAULT NULL",
      "`landplotdirection` text DEFAULT NULL",
      "`facingdirection` text DEFAULT NULL",
      "`surroundinginfrastructure` text DEFAULT NULL",
      "`sfno` text DEFAULT NULL",
      "`landtype` text DEFAULT NULL",
      "`topography` text DEFAULT NULL",
      "`soiltype` text DEFAULT NULL",
      "`irrigationfacilities` text DEFAULT NULL",
      "`waterresource` text DEFAULT NULL",
      "`fenchingresource` text DEFAULT NULL",
      "`ownername` text DEFAULT NULL",
      "`ownermobileno` text DEFAULT NULL",
      "`owneremail` text DEFAULT NULL",
      "`alternatename` text DEFAULT NULL",
      "`alternatemobileno` text DEFAULT NULL",
      "`alternateemail` text DEFAULT NULL",
      "`ownershiptype` text DEFAULT NULL",
      "`visitavailabledate` text DEFAULT NULL",
      "`visitavailabletime` text DEFAULT NULL",
      "`cropsuitability` text DEFAULT NULL",
      "`existingplantation` text DEFAULT NULL",
      "`electricityconnection` text DEFAULT NULL",
      "`borewell` text DEFAULT NULL",
      "`storagetank` text DEFAULT NULL",
      "`watersources` text DEFAULT NULL",
      "`proximitywatersource` text DEFAULT NULL",
      "`nearbyutilities` text DEFAULT NULL",
      "`accessibility` text DEFAULT NULL",
      "`price` text DEFAULT NULL",
      "`expectedsaleprice` varchar(255) DEFAULT NULL",
      "`sales` text DEFAULT NULL",
      "`timeforregistration` text DEFAULT NULL",
      "`negotiable` text DEFAULT NULL",
      "`registrationcharges` text DEFAULT NULL",
      "`advancepayment` text DEFAULT NULL",
      "`loanoption` text DEFAULT NULL",
      "`ownershiptitleverified` text DEFAULT NULL",
      "`patta_chitta_verified` text DEFAULT NULL",
      "`encumbrancecertificate` text DEFAULT NULL",
      "`tslr_fmb` text DEFAULT NULL",
      "`adangal` text DEFAULT NULL",
      "`agentname` text DEFAULT NULL",
      "`agencyname` text DEFAULT NULL",
      "`contactdetail` text DEFAULT NULL",
      "`commissionterms` text DEFAULT NULL",
      "`latitude_longitude` text DEFAULT NULL",
      "`photo1` text DEFAULT NULL",
      "`photo2` text DEFAULT NULL",
      "`photo3` text DEFAULT NULL",
      "`photo4` text DEFAULT NULL",
      "`photo5` text DEFAULT NULL",
      "`photo6` text DEFAULT NULL",
      "`photo7` text DEFAULT NULL",
      "`photo8` text DEFAULT NULL",
      "`photo9` text DEFAULT NULL",
      "`photo10` text DEFAULT NULL",
      "`remark` text DEFAULT NULL",
      "`attachment1` text DEFAULT NULL",
      "`attachment2` text DEFAULT NULL",
      "`attachment3` text DEFAULT NULL",
      "`attachment4` text DEFAULT NULL",
      "`attachment5` text DEFAULT NULL",
      "`attachment6` text DEFAULT NULL",
      "`property_ownership` text DEFAULT NULL",
      "`open_slides` text DEFAULT NULL",
      "`road_width` text DEFAULT NULL",
      "`authority_approved` text DEFAULT NULL",
      "`boundary_wall` text DEFAULT NULL",
      "`parking` text DEFAULT NULL",
      "`key_highlight` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL",
      "`meta_title` text DEFAULT NULL",
      "`meta_keywords` text DEFAULT NULL",
      "`slug_url` text DEFAULT NULL",
      "`meta_description` text NULL",
      "`status` int(11) DEFAULT NULL",
      "`booking_status` tinyint(4) DEFAULT NULL",
      "`update_status` tinyint(4) DEFAULT NULL",
      "`monthly_rent` varchar(100) NULL",
      "`facing` varchar(100) NULL",
      "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP"
    ],
    "indexes": [
      {
        "name": "idx_farmlands_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_farmlands_posttype",
        "columns": [
          "posttype"
        ],
        "unique": false
      },
      {
        "name": "idx_farmlands_sublocation",
        "columns": [
          "sublocation"
        ],
        "unique": false
      },
      {
        "name": "idx_farmlands_totalarea",
        "columns": [
          "totalarea"
        ],
        "unique": false
      },
      {
        "name": "idx_farmlands_expectedsaleprice",
        "columns": [
          "expectedsaleprice"
        ],
        "unique": false
      },
      {
        "name": "idx_farmlands_monthly_rent",
        "columns": [
          "monthly_rent"
        ],
        "unique": false
      },
      {
        "name": "idx_farmlands_facing",
        "columns": [
          "facing"
        ],
        "unique": false
      },
      {
        "name": "idx_farmlands_booking_status",
        "columns": [
          "booking_status"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "commercial_space",
    "autoIncrement": 746,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(15) NULL",
      "`common_space_code` varchar(100) NULL",
      "`posttype` varchar(100) DEFAULT NULL",
      "`propertytype` varchar(100) DEFAULT NULL",
      "`propertyname` text DEFAULT NULL",
      "`address` text DEFAULT NULL",
      "`sublocation` varchar(100) DEFAULT NULL",
      "`roadaccess` text DEFAULT NULL",
      "`roadname` text DEFAULT NULL",
      "`sale` text DEFAULT NULL",
      "`propertyuse` varchar(100) DEFAULT NULL",
      "`transactiontype` text DEFAULT NULL",
      "`underconstruction_date` text DEFAULT NULL",
      "`tower_nos` text DEFAULT NULL",
      "`lift_nos` text DEFAULT NULL",
      "`plotarea` text DEFAULT NULL",
      "`unitsize` varchar(100) DEFAULT NULL",
      "`facing` varchar(100) DEFAULT NULL",
      "`floor_nos` text DEFAULT NULL",
      "`floor` varchar(100) DEFAULT NULL",
      "`dimension` text DEFAULT NULL",
      "`ageofproperty` varchar(100) DEFAULT NULL",
      "`accessibility` text DEFAULT NULL",
      "`ownername` text DEFAULT NULL",
      "`ownermobileno` text DEFAULT NULL",
      "`owneremail` text DEFAULT NULL",
      "`alternatename` text DEFAULT NULL",
      "`alternatemobileno` text DEFAULT NULL",
      "`alternateemail` text DEFAULT NULL",
      "`ownershiptype` text DEFAULT NULL",
      "`visitavailabledate` text DEFAULT NULL",
      "`visitavailabletime` text DEFAULT NULL",
      "`shared_washroom_nos` text DEFAULT NULL",
      "`shared_individual_nos` text DEFAULT NULL",
      "`frontage` text DEFAULT NULL",
      "`parking` text DEFAULT NULL",
      "`car_nos` text DEFAULT NULL",
      "`bike_nos` text DEFAULT NULL",
      "`outside_parking` text DEFAULT NULL",
      "`visitors_parking` text DEFAULT NULL",
      "`water` text DEFAULT NULL",
      "`electricity` text DEFAULT NULL",
      "`powerbackup` text DEFAULT NULL",
      "`liftfacility` text DEFAULT NULL",
      "`firesafety_compliance` text DEFAULT NULL",
      "`ceiling_height` text DEFAULT NULL",
      "`furnishing_status` text DEFAULT NULL",
      "`fullyfurnished` text DEFAULT NULL",
      "`cabins` text DEFAULT NULL",
      "`conferenceroom` text DEFAULT NULL",
      "`seater` text DEFAULT NULL",
      "`zoning` text DEFAULT NULL",
      "`tenant_mix` text DEFAULT NULL",
      "`price` text DEFAULT NULL",
      "`sqft_price` text DEFAULT NULL",
      "`expectedsaleprice` varchar(100) DEFAULT NULL",
      "`sales` text DEFAULT NULL",
      "`registration_time` text DEFAULT NULL",
      "`finance_facing` text DEFAULT NULL",
      "`approval` text DEFAULT NULL",
      "`deviation` text DEFAULT NULL",
      "`hyphotication` text DEFAULT NULL",
      "`negotiable` text DEFAULT NULL",
      "`registration_charges` text DEFAULT NULL",
      "`monthly_rent` varchar(100) DEFAULT NULL",
      "`security_deposit` text DEFAULT NULL",
      "`maintenance_charge` text DEFAULT NULL",
      "`lockinperiod` text DEFAULT NULL",
      "`taxes` text DEFAULT NULL",
      "`payment_mode` text DEFAULT NULL",
      "`ownershiptitle` text DEFAULT NULL",
      "`encumbrance_certificate` text DEFAULT NULL",
      "`rental_aggrement` text DEFAULT NULL",
      "`document_require` text DEFAULT NULL",
      "`tslr` text DEFAULT NULL",
      "`tax_receipt` text DEFAULT NULL",
      "`eb_receipt` text DEFAULT NULL",
      "`compartive_price` text DEFAULT NULL",
      "`rentalyield` text DEFAULT NULL",
      "`demand_area` text DEFAULT NULL",
      "`agentname` text DEFAULT NULL",
      "`agencyname` text DEFAULT NULL",
      "`contactdetail` text DEFAULT NULL",
      "`commission_terms` text DEFAULT NULL",
      "`latitude_longitude` text DEFAULT NULL",
      "`photo1` text DEFAULT NULL",
      "`photo2` text DEFAULT NULL",
      "`photo3` text DEFAULT NULL",
      "`photo4` text DEFAULT NULL",
      "`photo5` text DEFAULT NULL",
      "`photo6` text DEFAULT NULL",
      "`photo7` text DEFAULT NULL",
      "`photo8` text DEFAULT NULL",
      "`photo9` text DEFAULT NULL",
      "`photo10` text DEFAULT NULL",
      "`remark` text DEFAULT NULL",
      "`attachment1` text DEFAULT NULL",
      "`attachment2` text DEFAULT NULL",
      "`attachment3` text DEFAULT NULL",
      "`attachment4` text DEFAULT NULL",
      "`attachment5` text DEFAULT NULL",
      "`attachment6` text DEFAULT NULL",
      "`status` varchar(100) DEFAULT NULL",
      "`booking_status` tinyint(4) NOT NULL DEFAULT 1",
      "`update_status` text DEFAULT NULL",
      "`created_by` text DEFAULT NULL",
      "`created_at` timestamp NULL DEFAULT NULL",
      "`updated_at` timestamp NULL DEFAULT NULL",
      "`broadband` text DEFAULT NULL",
      "`cleaning_service` text DEFAULT NULL",
      "`flooring` text DEFAULT NULL",
      "`pantry` text DEFAULT NULL",
      "`youtube_url` text NULL",
      "`lease` text DEFAULT NULL",
      "`tax` text DEFAULT NULL",
      "`carpet_area` text DEFAULT NULL",
      "`meeting_room` text DEFAULT NULL",
      "`stair_case` text DEFAULT NULL",
      "`key_highlight` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL",
      "`meta_title` text DEFAULT NULL",
      "`meta_keywords` text NULL",
      "`slug_url` varchar(255) DEFAULT NULL",
      "`meta_description` text NULL"
    ],
    "indexes": [
      {
        "name": "idx_commercial_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_commercial_posttype",
        "columns": [
          "posttype"
        ],
        "unique": false
      },
      {
        "name": "idx_commercial_propertytype",
        "columns": [
          "propertytype"
        ],
        "unique": false
      },
      {
        "name": "idx_commercial_sublocation",
        "columns": [
          "sublocation"
        ],
        "unique": false
      },
      {
        "name": "idx_commercial_propertyuse",
        "columns": [
          "propertyuse"
        ],
        "unique": false
      },
      {
        "name": "idx_commercial_unitsize",
        "columns": [
          "unitsize"
        ],
        "unique": false
      },
      {
        "name": "idx_commercial_floor",
        "columns": [
          "floor"
        ],
        "unique": false
      },
      {
        "name": "idx_commercial_ageofproperty",
        "columns": [
          "ageofproperty"
        ],
        "unique": false
      },
      {
        "name": "idx_commercial_expectedsaleprice",
        "columns": [
          "expectedsaleprice"
        ],
        "unique": false
      },
      {
        "name": "idx_commercial_monthly_rent",
        "columns": [
          "monthly_rent"
        ],
        "unique": false
      },
      {
        "name": "idx_commercial_booking_status",
        "columns": [
          "booking_status"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "industrial_spaces",
    "autoIncrement": 125,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(50) DEFAULT NULL",
      "`industrial_space_code` varchar(50) DEFAULT NULL",
      "`posttype` varchar(50) DEFAULT NULL",
      "`propertytype` varchar(50) DEFAULT NULL",
      "`propertyname` text DEFAULT NULL",
      "`address` text DEFAULT NULL",
      "`sublocation` varchar(50) DEFAULT NULL",
      "`roadaccess` text DEFAULT NULL",
      "`roadname` text DEFAULT NULL",
      "`sale` text DEFAULT NULL",
      "`building_type` text DEFAULT NULL",
      "`transaction_type` text DEFAULT NULL",
      "`propertyuse` varchar(100) DEFAULT NULL",
      "`handover_date` text DEFAULT NULL",
      "`plot_area` text DEFAULT NULL",
      "`buildup_area` varchar(50) DEFAULT NULL",
      "`covered_area` text DEFAULT NULL",
      "`open_area` text DEFAULT NULL",
      "`ceiling_height` text DEFAULT NULL",
      "`floor_type` text DEFAULT NULL",
      "`bays_nos` text DEFAULT NULL",
      "`cabins_nos` text DEFAULT NULL",
      "`power_supply1` text DEFAULT NULL",
      "`power_supply2` text DEFAULT NULL",
      "`power_supply3` text DEFAULT NULL",
      "`water_supply` text DEFAULT NULL",
      "`specify_source` text DEFAULT NULL",
      "`age_of_property` varchar(50) DEFAULT NULL",
      "`parking_facility` text DEFAULT NULL",
      "`truck_parking_nos` text DEFAULT NULL",
      "`car_parking_nos` text DEFAULT NULL",
      "`bike_parking_nos` text DEFAULT NULL",
      "`ownername` text DEFAULT NULL",
      "`ownermobileno` text DEFAULT NULL",
      "`owneremail` text DEFAULT NULL",
      "`alternatename` text DEFAULT NULL",
      "`alternatemobileno` text DEFAULT NULL",
      "`alternateemail` text DEFAULT NULL",
      "`ownershiptype` text DEFAULT NULL",
      "`availabledate` text DEFAULT NULL",
      "`availabletime` text DEFAULT NULL",
      "`ownership_verified` text DEFAULT NULL",
      "`fire_safety_compilance` text DEFAULT NULL",
      "`building_approval_certification` text DEFAULT NULL",
      "`pollution_clearance` text DEFAULT NULL",
      "`legal_clearance_available` text DEFAULT NULL",
      "`legal_clearance_details` text DEFAULT NULL",
      "`blueprint_layout` text DEFAULT NULL",
      "`proximity_highway` text DEFAULT NULL",
      "`nearby_railway_station` text DEFAULT NULL",
      "`nearby_port` text DEFAULT NULL",
      "`nearby_airport` text DEFAULT NULL",
      "`transport_access` text DEFAULT NULL",
      "`labour_force_availability` text DEFAULT NULL",
      "`power_backup` text DEFAULT NULL",
      "`loading_unloading_bays` text DEFAULT NULL",
      "`loading_specify_number` text DEFAULT NULL",
      "`warehouse_storage` text DEFAULT NULL",
      "`warehouse_specify_number` text DEFAULT NULL",
      "`truck_access` text DEFAULT NULL",
      "`truck_specify_number` text DEFAULT NULL",
      "`crane_lift` text DEFAULT NULL",
      "`crane_lift_specify_number` text DEFAULT NULL",
      "`workers_faciltiy` text DEFAULT NULL",
      "`price` text DEFAULT NULL",
      "`expectedsaleprice` varchar(50) DEFAULT NULL",
      "`sales` text DEFAULT NULL",
      "`registration_time` text DEFAULT NULL",
      "`negoitable` text DEFAULT NULL",
      "`registration_charge` text DEFAULT NULL",
      "`lease_term` text DEFAULT NULL",
      "`payment_mode` text DEFAULT NULL",
      "`ownershiptitle` text DEFAULT NULL",
      "`encumbrance_certificate` text DEFAULT NULL",
      "`rental_aggrement` text DEFAULT NULL",
      "`tslr` text DEFAULT NULL",
      "`tax_receipt` text DEFAULT NULL",
      "`eb_receipt` text DEFAULT NULL",
      "`comparative_price` text DEFAULT NULL",
      "`rental_yield` text DEFAULT NULL",
      "`demand_area` text DEFAULT NULL",
      "`agentname` text DEFAULT NULL",
      "`agencyname` text DEFAULT NULL",
      "`contactdetail` text DEFAULT NULL",
      "`commission_terms` text DEFAULT NULL",
      "`monthly_rent` varchar(50) DEFAULT NULL",
      "`security_deposit` text DEFAULT NULL",
      "`maintenance_charge` text DEFAULT NULL",
      "`lock_period` text DEFAULT NULL",
      "`taxes` text DEFAULT NULL",
      "`latitude_longitude` text DEFAULT NULL",
      "`photo1` text DEFAULT NULL",
      "`photo2` text DEFAULT NULL",
      "`photo3` text DEFAULT NULL",
      "`photo4` text DEFAULT NULL",
      "`photo5` text DEFAULT NULL",
      "`photo6` text DEFAULT NULL",
      "`photo7` text DEFAULT NULL",
      "`photo8` text DEFAULT NULL",
      "`photo9` text DEFAULT NULL",
      "`photo10` text DEFAULT NULL",
      "`remark` text DEFAULT NULL",
      "`attachment1` text DEFAULT NULL",
      "`attachment2` text DEFAULT NULL",
      "`attachment3` text DEFAULT NULL",
      "`attachment4` text DEFAULT NULL",
      "`attachment5` text DEFAULT NULL",
      "`attachment6` text DEFAULT NULL",
      "`open_slides` text DEFAULT NULL",
      "`personal_washroom` text DEFAULT NULL",
      "`unit_no` text DEFAULT NULL",
      "`youtube_url` text DEFAULT NULL",
      "`key_highlight` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL",
      "`meta_title` text DEFAULT NULL",
      "`meta_keywords` text NULL",
      "`meta_description` text NULL",
      "`slug_url` text DEFAULT NULL",
      "`booking_status` int(11) DEFAULT NULL",
      "`status` varchar(10) DEFAULT NULL",
      "`update_status` text DEFAULT NULL",
      "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP"
    ],
    "indexes": [
      {
        "name": "idx_industrial_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_industrial_posttype",
        "columns": [
          "posttype"
        ],
        "unique": false
      },
      {
        "name": "idx_industrial_propertytype",
        "columns": [
          "propertytype"
        ],
        "unique": false
      },
      {
        "name": "idx_industrial_sublocation",
        "columns": [
          "sublocation"
        ],
        "unique": false
      },
      {
        "name": "idx_industrial_propertyuse",
        "columns": [
          "propertyuse"
        ],
        "unique": false
      },
      {
        "name": "idx_industrial_buildup_area",
        "columns": [
          "buildup_area"
        ],
        "unique": false
      },
      {
        "name": "idx_industrial_age_of_property",
        "columns": [
          "age_of_property"
        ],
        "unique": false
      },
      {
        "name": "idx_industrial_expectedsaleprice",
        "columns": [
          "expectedsaleprice"
        ],
        "unique": false
      },
      {
        "name": "idx_industrial_monthly_rent",
        "columns": [
          "monthly_rent"
        ],
        "unique": false
      },
      {
        "name": "idx_industrial_booking_status",
        "columns": [
          "booking_status"
        ],
        "unique": false
      }
    ]
  },
  {
    "name": "coworkers",
    "autoIncrement": 10,
    "columns": [
      "`id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
      "`date` varchar(50) DEFAULT NULL",
      "`coworkers_code` varchar(50) DEFAULT NULL",
      "`posttype` varchar(50) DEFAULT NULL",
      "`propertytype` varchar(50) DEFAULT NULL",
      "`propertyname` text DEFAULT NULL",
      "`address` text DEFAULT NULL",
      "`sublocation` varchar(50) DEFAULT NULL",
      "`buildup_area` varchar(50) DEFAULT NULL",
      "`carpet_area` text DEFAULT NULL",
      "`workstation_available_nos` text DEFAULT NULL",
      "`private_cabins_nos` text DEFAULT NULL",
      "`meeting_rooms_nos` text DEFAULT NULL",
      "`common_area` text DEFAULT NULL",
      "`ownername` text DEFAULT NULL",
      "`ownermobileno` text DEFAULT NULL",
      "`owneremail` text DEFAULT NULL",
      "`alternatename` text DEFAULT NULL",
      "`alternatemobileno` text DEFAULT NULL",
      "`alternateemail` text DEFAULT NULL",
      "`ownershiptype` text DEFAULT NULL",
      "`availabledate` text DEFAULT NULL",
      "`availabletime` text DEFAULT NULL",
      "`condition_space` varchar(50) DEFAULT NULL",
      "`wifi` text DEFAULT NULL",
      "`power_backup` text DEFAULT NULL",
      "`air_conditioning` text DEFAULT NULL",
      "`cctv` text DEFAULT NULL",
      "`pantry` text DEFAULT NULL",
      "`parking` text DEFAULT NULL",
      "`carparking_nos` text DEFAULT NULL",
      "`bikeparking_nos` text DEFAULT NULL",
      "`security_staff` text DEFAULT NULL",
      "`elevator_access` text DEFAULT NULL",
      "`furniture_provider` text DEFAULT NULL",
      "`accessibility` text DEFAULT NULL",
      "`expected_rent_persqft` text DEFAULT NULL",
      "`expected_rent_perseat` varchar(50) DEFAULT NULL",
      "`monthly_rent` varchar(50) DEFAULT NULL",
      "`security_deposit` text DEFAULT NULL",
      "`advance_rent` text DEFAULT NULL",
      "`lease_term` text DEFAULT NULL",
      "`incremental_rent` text DEFAULT NULL",
      "`lockin_period` text DEFAULT NULL",
      "`maintenance_charge` text DEFAULT NULL",
      "`electricity_charge` text DEFAULT NULL",
      "`comparity_charge` text DEFAULT NULL",
      "`rental_yield` text DEFAULT NULL",
      "`demand_area` text DEFAULT NULL",
      "`agentname` text DEFAULT NULL",
      "`agencyname` text DEFAULT NULL",
      "`contact_detail` text DEFAULT NULL",
      "`commission_terms` text DEFAULT NULL",
      "`latitude_longitude` text DEFAULT NULL",
      "`photo1` text DEFAULT NULL",
      "`photo2` text DEFAULT NULL",
      "`photo3` text DEFAULT NULL",
      "`photo4` text DEFAULT NULL",
      "`photo5` text DEFAULT NULL",
      "`photo6` text DEFAULT NULL",
      "`photo7` text DEFAULT NULL",
      "`photo8` text DEFAULT NULL",
      "`photo9` text DEFAULT NULL",
      "`photo10` text DEFAULT NULL",
      "`remark` text DEFAULT NULL",
      "`attachment1` text DEFAULT NULL",
      "`attachment2` text DEFAULT NULL",
      "`attachment3` text DEFAULT NULL",
      "`attachment4` text DEFAULT NULL",
      "`attachment5` text DEFAULT NULL",
      "`attachment6` text DEFAULT NULL",
      "`meta_title` text DEFAULT NULL",
      "`meta_keywords` text DEFAULT NULL",
      "`slug_url` varchar(255) DEFAULT NULL",
      "`meta_description` text NULL",
      "`booking_status` int(11) DEFAULT NULL",
      "`status` varchar(10) DEFAULT NULL",
      "`update_status` text DEFAULT NULL",
      "`unittype` varchar(100) NULL",
      "`floor` varchar(50) NULL",
      "`facing` varchar(50) NULL",
      "`property_age` varchar(100) NULL",
      "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
      "`updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP"
    ],
    "indexes": [
      {
        "name": "idx_coworkers_status",
        "columns": [
          "status"
        ],
        "unique": false
      },
      {
        "name": "idx_coworkers_posttype",
        "columns": [
          "posttype"
        ],
        "unique": false
      },
      {
        "name": "idx_coworkers_sublocation",
        "columns": [
          "sublocation"
        ],
        "unique": false
      },
      {
        "name": "idx_coworkers_buildup_area",
        "columns": [
          "buildup_area"
        ],
        "unique": false
      },
      {
        "name": "idx_coworkers_unittype",
        "columns": [
          "unittype"
        ],
        "unique": false
      },
      {
        "name": "idx_coworkers_condition_space",
        "columns": [
          "condition_space"
        ],
        "unique": false
      },
      {
        "name": "idx_coworkers_floor",
        "columns": [
          "floor"
        ],
        "unique": false
      },
      {
        "name": "idx_coworkers_facing",
        "columns": [
          "facing"
        ],
        "unique": false
      },
      {
        "name": "idx_coworkers_property_age",
        "columns": [
          "property_age"
        ],
        "unique": false
      },
      {
        "name": "idx_coworkers_expected_rent_perseat",
        "columns": [
          "expected_rent_perseat"
        ],
        "unique": false
      },
      {
        "name": "idx_coworkers_monthly_rent",
        "columns": [
          "monthly_rent"
        ],
        "unique": false
      },
      {
        "name": "idx_coworkers_booking_status",
        "columns": [
          "booking_status"
        ],
        "unique": false
      }
    ]
  }
];

const quoteIdentifier = (identifier: string): string =>
  `\`${identifier.replace(/\`/g, '\`\`')}\``;

export class CreateMajestanLegacySchema1778544000000
  implements MigrationInterface
{
  name = 'CreateMajestanLegacySchema1778544000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of legacyTables) {
      await this.createOrUpgradeTable(queryRunner, table);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...legacyTables].reverse()) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${quoteIdentifier(table.name)}`);
    }
  }

  private async createOrUpgradeTable(
    queryRunner: QueryRunner,
    table: LegacyTableDefinition,
  ): Promise<void> {
    const columnsSql = table.columns.map((column) => `  ${column}`).join(',\n');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table.name)} (
${columnsSql}
      ) ENGINE=InnoDB AUTO_INCREMENT=${table.autoIncrement} DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC
    `);

    await this.ensureColumns(queryRunner, table);
    await this.ensureIndexes(queryRunner, table);
  }

  private async ensureColumns(
    queryRunner: QueryRunner,
    table: LegacyTableDefinition,
  ): Promise<void> {
    const current = await queryRunner.getTable(table.name);
    if (!current) {
      return;
    }

    const currentColumns = new Set(current.columns.map((column) => column.name));

    for (const columnDefinition of table.columns) {
      const columnName = this.extractColumnName(columnDefinition);
      if (!columnName || columnName === 'id' || currentColumns.has(columnName)) {
        continue;
      }

      await queryRunner.query(
        `ALTER TABLE ${quoteIdentifier(table.name)} ADD COLUMN ${columnDefinition}`,
      );
      currentColumns.add(columnName);
    }
  }

  private async ensureIndexes(
    queryRunner: QueryRunner,
    table: LegacyTableDefinition,
  ): Promise<void> {
    const current = await queryRunner.getTable(table.name);
    if (!current) {
      return;
    }

    const currentColumns = new Set(current.columns.map((column) => column.name));
    const currentIndexes = new Set(current.indices.map((index) => index.name));

    for (const index of table.indexes) {
      if (currentIndexes.has(index.name)) {
        continue;
      }

      if (!index.columns.every((column) => currentColumns.has(column))) {
        continue;
      }

      const uniqueSql = index.unique ? 'UNIQUE ' : '';
      const columnsSql = index.columns.map(quoteIdentifier).join(', ');

      await queryRunner.query(
        `CREATE ${uniqueSql}INDEX ${quoteIdentifier(index.name)} ON ${quoteIdentifier(
          table.name,
        )} (${columnsSql})`,
      );
      currentIndexes.add(index.name);
    }
  }

  private extractColumnName(columnDefinition: string): string | null {
    return columnDefinition.match(/^\`([^\`]+)\`/)?.[1] ?? null;
  }
}
