/*
 * Copyright 2025 The Kubernetes Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import '../../i18n/config';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

// Namespace discovery is external to the form interaction under test.
vi.mock('../../lib/k8s/namespace', () => ({
  default: { useList: () => [[], null] },
}));

const { default: CreatePVCForm } = await import('./CreatePVCForm');

function resourceWithClass(storageClassName?: string) {
  return {
    metadata: { name: 'app-data', namespace: 'default' },
    spec: {
      accessModes: ['ReadWriteOnce'],
      resources: { requests: { storage: '5Gi' } },
      storageClassName,
    },
  };
}

function renderEditable(storageClassName?: string) {
  const onChange = vi.fn();
  function Form() {
    const [resource, setResource] = React.useState<Record<string, any>>(
      resourceWithClass(storageClassName)
    );
    return (
      <CreatePVCForm
        resource={resource}
        onChange={next => {
          onChange(next);
          setResource(next);
        }}
      />
    );
  }
  render(<Form />);
  return onChange;
}

const classInput = () => screen.getByRole('textbox', { name: 'Storage Class' });
const mode = (name: string) => screen.getByRole('radio', { name });

describe('CreatePVCForm StorageClass editing', () => {
  it('keeps focus and specify mode while replacing the name', async () => {
    const user = userEvent.setup();
    const onChange = renderEditable('fast-ssd');
    const input = classInput();
    await user.clear(input);
    expect(classInput()).toBe(input);
    expect(input).toHaveFocus();
    expect(mode('Specify StorageClass')).toBeChecked();
    expect(onChange.mock.lastCall?.[0].spec).not.toHaveProperty('storageClassName');
    await user.type(input, 'standard');
    expect(input).toHaveValue('standard');
    expect(onChange).toHaveBeenLastCalledWith(resourceWithClass('standard'));
  });

  it.each([undefined, ''])('allows specifying a name starting from %j', async initial => {
    const user = userEvent.setup();
    const onChange = renderEditable(initial);
    await user.click(mode('Specify StorageClass'));
    await user.type(classInput(), 'fast-ssd');
    expect(onChange).toHaveBeenLastCalledWith(resourceWithClass('fast-ssd'));
  });

  it('preserves the distinction between default and static provisioning', async () => {
    const user = userEvent.setup();
    const onChange = renderEditable('fast-ssd');
    await user.click(mode('No StorageClass (static provisioning)'));
    expect(onChange).toHaveBeenLastCalledWith(resourceWithClass(''));
    expect(screen.queryByRole('textbox', { name: 'Storage Class' })).toBeNull();
    await user.click(mode('Use default StorageClass'));
    expect(onChange.mock.lastCall?.[0].spec).not.toHaveProperty('storageClassName');
    expect(mode('Use default StorageClass')).toBeChecked();
  });

  it('reflects external resource changes such as edits in the YAML editor', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CreatePVCForm resource={resourceWithClass('fast-ssd')} onChange={onChange} />
    );
    expect(classInput()).toHaveValue('fast-ssd');
    rerender(<CreatePVCForm resource={resourceWithClass('')} onChange={onChange} />);
    expect(mode('No StorageClass (static provisioning)')).toBeChecked();
    rerender(<CreatePVCForm resource={resourceWithClass()} onChange={onChange} />);
    expect(mode('Use default StorageClass')).toBeChecked();
    rerender(<CreatePVCForm resource={resourceWithClass('standard')} onChange={onChange} />);
    expect(classInput()).toHaveValue('standard');
    expect(onChange).not.toHaveBeenCalled();
  });
});
