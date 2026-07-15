import type { Schema, Struct } from '@strapi/strapi';

export interface BioBarAdmission extends Struct.ComponentSchema {
  collectionName: 'components_bio_bar_admissions';
  info: {
    displayName: 'bar_admission';
  };
  attributes: {
    jurisdiction: Schema.Attribute.String;
    year: Schema.Attribute.String;
  };
}

export interface BioCredential extends Struct.ComponentSchema {
  collectionName: 'components_bio_credentials';
  info: {
    displayName: 'Credential';
    icon: 'crown';
  };
  attributes: {
    label: Schema.Attribute.String;
    primary: Schema.Attribute.String;
    secondary: Schema.Attribute.String;
  };
}

export interface BioEducation extends Struct.ComponentSchema {
  collectionName: 'components_bio_educations';
  info: {
    displayName: 'education';
  };
  attributes: {
    degree: Schema.Attribute.String;
    school: Schema.Attribute.String;
  };
}

export interface BioHighlight extends Struct.ComponentSchema {
  collectionName: 'components_bio_highlights';
  info: {
    displayName: 'highlight';
  };
  attributes: {
    description: Schema.Attribute.String;
    label: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface BioStat extends Struct.ComponentSchema {
  collectionName: 'components_bio_stats';
  info: {
    displayName: 'stat';
  };
  attributes: {
    description: Schema.Attribute.Blocks;
    value: Schema.Attribute.String;
  };
}

export interface SharedContact extends Struct.ComponentSchema {
  collectionName: 'components_shared_contacts';
  info: {
    displayName: 'contact';
  };
  attributes: {
    address: Schema.Attribute.Text;
    email: Schema.Attribute.Email;
    intro: Schema.Attribute.Text;
    phone: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'bio.bar-admission': BioBarAdmission;
      'bio.credential': BioCredential;
      'bio.education': BioEducation;
      'bio.highlight': BioHighlight;
      'bio.stat': BioStat;
      'shared.contact': SharedContact;
    }
  }
}
